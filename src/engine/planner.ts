import { nutritionConfig } from './config'
import { isFiniteNumber, roundTo, warn } from './math'
import type {
  GeneratedPlan,
  HourlyTargets,
  PlanIntake,
  PlannerProduct,
  PlanTotals,
  SegmentId,
  SegmentSummary,
  ShoppingLine,
  Sport,
  TriathlonInput,
  Warning,
} from './types'

type Kind = 'liquide' | 'gel' | 'solide' | 'sel'

interface PoolItem {
  id: string
  name: string
  type: PlannerProduct['type']
  flavor: string | null
  carbsG: number
  sodiumMg: number
  caffeineMg: number
  volumeMl: number
  inBox: boolean
  favorite: boolean
  preferredFlavor: boolean
  remaining: number
  unlimited: boolean
}

export interface PlanRequest {
  sport: Sport
  durationMinutes: number
  targets: HourlyTargets
  products: PlannerProduct[]
  triathlon?: TriathlonInput | null
  allowOutsideBox: boolean
}

function nonNegative(value: number): number {
  if (!isFiniteNumber(value) || value < 0) return 0
  return value
}

function kindOf(type: string): Kind {
  if (type === 'boisson' || type === 'eau') return 'liquide'
  if (type === 'gel') return 'gel'
  if (type === 'capsule_sel') return 'sel'
  return 'solide'
}

export function buildSegments(request: PlanRequest): { segments: SegmentSummary[]; warnings: Warning[] } {
  const warnings: Warning[] = []
  const carbs = nonNegative(request.targets.carbsGPerHour)
  const fluid = nonNegative(request.targets.fluidMlPerHour)
  const sodium = nonNegative(request.targets.sodiumMgPerHour)

  if (request.sport !== 'triathlon' || !request.triathlon) {
    const end = Math.max(0, request.durationMinutes)
    return {
      segments: [
        {
          segment: 'effort',
          startMinute: 0,
          endMinute: end,
          carbRateGPerHour: carbs,
          fluidRateMlPerHour: fluid,
          sodiumRateMgPerHour: sodium,
          fuel: end > 0,
        },
      ],
      warnings,
    }
  }

  const tri = request.triathlon
  const parts: Array<{ segment: SegmentId; minutes: number; fuel: boolean }> = [
    { segment: 'natation', minutes: nonNegative(tri.swimMin), fuel: false },
    { segment: 't1', minutes: nonNegative(tri.t1Min), fuel: false },
    { segment: 'velo', minutes: nonNegative(tri.bikeMin), fuel: true },
    { segment: 't2', minutes: nonNegative(tri.t2Min), fuel: false },
    { segment: 'course_a_pied', minutes: nonNegative(tri.runMin), fuel: true },
  ]
  if ([tri.swimMin, tri.t1Min, tri.bikeMin, tri.t2Min, tri.runMin].some((value) => !isFiniteNumber(value) || value < 0)) {
    warnings.push(warn('INVALID_SEGMENT', 'Un segment négatif ou invalide a été ramené à zéro.'))
  }

  const bike = nonNegative(tri.bikeMin)
  const run = nonNegative(tri.runMin)
  const runFactor = nutritionConfig.planner.triathlon.runCarbFactor
  const maxInstant = nutritionConfig.planner.triathlon.maxInstantCarbRate
  let bikeRate = 0
  let runRate = 0
  if (bike > 0 && run > 0) {
    runRate = roundTo(carbs * runFactor, nutritionConfig.carbs.roundDigits)
    const fuelMin = bike + run
    bikeRate = roundTo((carbs * fuelMin - runRate * run) / bike, nutritionConfig.carbs.roundDigits)
    if (bikeRate > maxInstant) {
      bikeRate = maxInstant
      warnings.push(
        warn(
          'BIKE_RATE_CAPPED',
          `Le débit vélo est plafonné à ${maxInstant} g/h pour rester réaliste.`,
        ),
      )
    }
  } else if (bike > 0) {
    bikeRate = carbs
  } else if (run > 0) {
    runRate = roundTo(carbs * runFactor, nutritionConfig.carbs.roundDigits)
    warnings.push(
      warn(
        'RUN_ONLY_REDUCED',
        'Sans vélo, la course à pied garde un débit de glucides plus prudent.',
      ),
    )
  }

  let cursor = 0
  const segments: SegmentSummary[] = parts.map((part) => {
    const start = cursor
    cursor += part.minutes
    const rate = part.segment === 'velo' ? bikeRate : part.segment === 'course_a_pied' ? runRate : 0
    const active = part.fuel && part.minutes > 0
    return {
      segment: part.segment,
      startMinute: start,
      endMinute: cursor,
      carbRateGPerHour: active ? rate : 0,
      fluidRateMlPerHour: active ? fluid : 0,
      sodiumRateMgPerHour: active ? sodium : 0,
      fuel: active,
    }
  })
  return { segments, warnings }
}

function placeSlots(start: number, end: number, count: number): number[] {
  const lead = nutritionConfig.planner.leadInMinutes
  const buffer = nutritionConfig.planner.endBufferMinutes
  const minGap = nutritionConfig.planner.minSpacingMinutes
  const span = end - start
  const usableStart = start + Math.min(lead, Math.floor(span / 3))
  const usableEnd = Math.max(usableStart, end - buffer)
  if (count === 1) {
    return [Math.round((usableStart + usableEnd) / 2)]
  }
  const step = (usableEnd - usableStart) / (count - 1)
  if (step < minGap) {
    const maxCount = Math.floor((usableEnd - usableStart) / minGap) + 1
    return placeSlots(start, end, Math.max(1, maxCount))
  }
  const raw = Array.from({ length: count }, (_, index) => Math.round(usableStart + step * index))
  const spaced: number[] = []
  for (const minute of raw) {
    const previous = spaced[spaced.length - 1]
    if (previous == null || minute - previous >= minGap) spaced.push(minute)
  }
  return spaced
}

function slotsFor(segment: SegmentSummary): number[] {
  if (!segment.fuel) return []
  const length = segment.endMinute - segment.startMinute
  if (length < nutritionConfig.duration.minFuelWindowMinutes) return []
  const hours = length / 60
  const totalCarbs = segment.carbRateGPerHour * hours
  const byCarbs = Math.max(1, Math.ceil(totalCarbs / nutritionConfig.planner.typicalPortionCarbsG))
  const byTime = Math.max(1, Math.ceil(length / nutritionConfig.planner.maxSpacingMinutes))
  return placeSlots(segment.startMinute, segment.endMinute, Math.max(byCarbs, byTime))
}

function toPool(products: PlannerProduct[], allowOutsideBox: boolean, warnings: Warning[]): PoolItem[] {
  const pool: PoolItem[] = []
  if (products.length === 0) {
    warnings.push(warn('EMPTY_BOX', 'La Box est vide : ajoutez des produits avant de construire un plan.'))
    return pool
  }
  const allExcluded = products.every((product) => product.excluded)
  if (allExcluded) {
    warnings.push(warn('ALL_EXCLUDED', 'Tous les produits sont exclus : rien ne peut être planifié.'))
    return pool
  }
  for (const product of products) {
    if (product.excluded) continue
    const inBox = product.inBox
    if (!inBox && !allowOutsideBox) continue
    const stock = isFiniteNumber(product.stock) ? Math.floor(product.stock) : null
    if (inBox) {
      const quantity = stock == null ? 0 : Math.max(0, stock)
      if (quantity <= 0) continue
      pool.push(decorate(product, quantity, false))
    } else {
      pool.push(decorate(product, Number.POSITIVE_INFINITY, true))
    }
  }
  if (pool.length === 0) {
    if (products.some((product) => product.inBox && !product.excluded)) {
      warnings.push(
        warn('INSUFFICIENT_STOCK', 'Les produits de la Box n’ont plus de stock utilisable.'),
      )
    } else {
      warnings.push(
        warn(
          'OUTSIDE_BOX_DISABLED',
          'Aucun produit de la Box n’est disponible. Autorisez les produits hors Box ou complétez le stock.',
        ),
      )
    }
  }
  return pool
}

function decorate(product: PlannerProduct, remaining: number, unlimited: boolean): PoolItem {
  return {
    id: product.id,
    name: product.name,
    type: product.type,
    flavor: product.flavor,
    carbsG: nonNegative(product.carbsG),
    sodiumMg: nonNegative(product.sodiumMg),
    caffeineMg: nonNegative(product.caffeineMg),
    volumeMl: nonNegative(product.volumeMl),
    inBox: product.inBox,
    favorite: Boolean(product.favorite),
    preferredFlavor: Boolean(product.preferredFlavor),
    remaining,
    unlimited,
  }
}

function desiredKind(index: number, sodiumStillNeeded: boolean, saltAvailable: boolean): Kind {
  const rhythm = index % nutritionConfig.planner.saltEvery
  if (rhythm === nutritionConfig.planner.saltEvery - 1) {
    if (sodiumStillNeeded && saltAvailable) return 'sel'
    return 'liquide'
  }
  if (rhythm === 1) return 'liquide'
  if (rhythm === 2) return 'solide'
  return 'gel'
}

function contribution(
  product: PoolItem,
  needs: { carbs: number; fluid: number; sodium: number },
  caffeineSoFar: number,
): number {
  if (product.carbsG === 0 && product.volumeMl === 0 && product.sodiumMg === 0) return -1
  let score = 0
  if (needs.carbs > 0 && product.carbsG > 0) score += Math.min(product.carbsG, needs.carbs)
  if (needs.fluid > 0 && product.volumeMl > 0) score += Math.min(product.volumeMl, needs.fluid) / 20
  if (needs.sodium > 0 && product.sodiumMg > 0) score += Math.min(product.sodiumMg, needs.sodium) / 20
  if (product.preferredFlavor) score += 12
  if (product.favorite) score += 8
  if (product.caffeineMg > 0 && caffeineSoFar >= nutritionConfig.planner.caffeineCautionMg) score -= 40
  if (product.carbsG > needs.carbs + 30 && needs.carbs > 0) score -= 15
  return score
}

function pickProduct(
  pool: PoolItem[],
  kind: Kind,
  needs: { carbs: number; fluid: number; sodium: number },
  caffeineSoFar: number,
): PoolItem | null {
  const ranked = pool
    .filter((product) => product.remaining > 0)
    .map((product) => {
      const base = contribution(product, needs, caffeineSoFar)
      const bonus = base < 0 ? 0 : kindOf(product.type) === kind ? 100 : 0
      return { product, score: base + bonus }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.product.id.localeCompare(b.product.id)
    })
  const best = ranked[0]
  if (!best || best.score <= 0) return null
  return best.product
}

function stillNeeded(needs: { carbs: number; fluid: number; sodium: number }): boolean {
  return (
    needs.carbs > nutritionConfig.planner.carbGapG ||
    needs.fluid > nutritionConfig.planner.fluidGapMl ||
    needs.sodium > nutritionConfig.planner.sodiumGapMg
  )
}

function targetTotals(segments: SegmentSummary[]): { carbsG: number; fluidMl: number; sodiumMg: number } {
  return segments.reduce(
    (total, segment) => {
      const hours = (segment.endMinute - segment.startMinute) / 60
      if (!segment.fuel) return total
      return {
        carbsG: total.carbsG + segment.carbRateGPerHour * hours,
        fluidMl: total.fluidMl + segment.fluidRateMlPerHour * hours,
        sodiumMg: total.sodiumMg + segment.sodiumRateMgPerHour * hours,
      }
    },
    { carbsG: 0, fluidMl: 0, sodiumMg: 0 },
  )
}

function emptyPlan(segments: SegmentSummary[], warnings: Warning[]): GeneratedPlan {
  const targets = roundTotals(targetTotals(segments))
  return {
    intakes: [],
    totals: { carbsG: 0, fluidMl: 0, sodiumMg: 0, caffeineMg: 0 },
    targetsTotal: targets,
    coverage: coverageOf({ carbsG: 0, fluidMl: 0, sodiumMg: 0, caffeineMg: 0 }, targets),
    shoppingList: [],
    segments,
    warnings,
  }
}

function roundTotals(totals: { carbsG: number; fluidMl: number; sodiumMg: number }) {
  return {
    carbsG: roundTo(totals.carbsG, 1),
    fluidMl: Math.round(totals.fluidMl),
    sodiumMg: Math.round(totals.sodiumMg),
  }
}

function coverageOf(totals: PlanTotals, targets: { carbsG: number; fluidMl: number; sodiumMg: number }) {
  const ratio = (actual: number, target: number) => (target <= 0 ? 1 : roundTo(actual / target, 2))
  return {
    carbs: ratio(totals.carbsG, targets.carbsG),
    fluid: ratio(totals.fluidMl, targets.fluidMl),
    sodium: ratio(totals.sodiumMg, targets.sodiumMg),
  }
}

function addMissing(lines: ShoppingLine[], product: PoolItem, units: number) {
  const existing = lines.find((line) => line.productId === product.id)
  if (existing) {
    existing.missing += units
    return
  }
  lines.push({
    productId: product.id,
    name: product.name,
    toBring: 0,
    missing: units,
    inBox: product.inBox,
  })
}

function bestDonor(pool: PoolItem[], field: 'carbsG' | 'volumeMl' | 'sodiumMg'): PoolItem | null {
  const ranked = [...pool].sort((a, b) => {
    if (b[field] !== a[field]) return b[field] - a[field]
    return a.id.localeCompare(b.id)
  })
  const donor = ranked.find((item) => item[field] > 0)
  return donor ?? null
}

function shoppingList(
  original: PlannerProduct[],
  pool: PoolItem[],
  used: Map<string, number>,
  totals: PlanTotals,
  targets: { carbsG: number; fluidMl: number; sodiumMg: number },
): ShoppingLine[] {
  const lines: ShoppingLine[] = []
  for (const product of original) {
    const count = used.get(product.id) ?? 0
    if (count <= 0) continue
    const stock = product.inBox && isFiniteNumber(product.stock) ? Math.max(0, Math.floor(product.stock)) : 0
    const missing = product.inBox ? Math.max(0, count - stock) : count
    lines.push({
      productId: product.id,
      name: product.name,
      toBring: count,
      missing,
      inBox: product.inBox,
    })
  }
  const carbGap = targets.carbsG - totals.carbsG
  if (carbGap > nutritionConfig.planner.carbGapG) {
    const donor = bestDonor(pool, 'carbsG')
    if (donor) addMissing(lines, donor, Math.ceil(carbGap / donor.carbsG))
  }
  const fluidGap = targets.fluidMl - totals.fluidMl
  if (fluidGap > nutritionConfig.planner.fluidGapMl) {
    const donor = bestDonor(pool, 'volumeMl')
    if (donor) addMissing(lines, donor, Math.ceil(fluidGap / donor.volumeMl))
  }
  const sodiumGap = targets.sodiumMg - totals.sodiumMg
  if (sodiumGap > nutritionConfig.planner.sodiumGapMg) {
    const donor = bestDonor(pool, 'sodiumMg')
    if (donor) addMissing(lines, donor, Math.ceil(sodiumGap / donor.sodiumMg))
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export function buildPlan(request: PlanRequest): GeneratedPlan {
  const warnings: Warning[] = []
  if (!isFiniteNumber(request.durationMinutes) || request.durationMinutes < 0) {
    warnings.push(warn('INVALID_DURATION', 'La durée de la sortie est invalide.'))
    return emptyPlan([], warnings)
  }

  const built = buildSegments(request)
  warnings.push(...built.warnings)
  const segments = built.segments
  const eventEnd = segments.reduce((max, segment) => Math.max(max, segment.endMinute), 0)
  if (eventEnd <= 0) {
    warnings.push(warn('INVALID_DURATION', 'La durée de la sortie doit être supérieure à zéro.'))
    return emptyPlan(segments, warnings)
  }

  const targets = roundTotals(targetTotals(segments))
  const pool = toPool(request.products, request.allowOutsideBox, warnings)
  if (pool.length === 0) return emptyPlan(segments, warnings)

  const slots = segments
    .flatMap((segment) => slotsFor(segment).map((minute) => ({ minute, segment })))
    .sort((a, b) => a.minute - b.minute)
  const spaced: Array<{ minute: number; segment: SegmentSummary }> = []
  for (const slot of slots) {
    const previous = spaced[spaced.length - 1]
    if (previous && slot.minute - previous.minute < nutritionConfig.planner.minSpacingMinutes) continue
    spaced.push(slot)
  }

  const intakes: PlanIntake[] = []
  const consumed = { carbs: 0, fluid: 0, sodium: 0, caffeine: 0 }
  const used = new Map<string, number>()
  let stockEmptied = false

  spaced.forEach((slot, index) => {
    const needs = {
      carbs: targets.carbsG - consumed.carbs,
      fluid: targets.fluidMl - consumed.fluid,
      sodium: targets.sodiumMg - consumed.sodium,
    }
    if (!stillNeeded(needs)) return
    const saltAvailable = pool.some((product) => kindOf(product.type) === 'sel' && product.remaining > 0)
    const kind = desiredKind(index, needs.sodium > nutritionConfig.planner.sodiumGapMg, saltAvailable)
    const chosen = pickProduct(pool, kind, needs, consumed.caffeine)
    if (!chosen) return
    if (!chosen.unlimited) {
      chosen.remaining -= 1
      if (chosen.remaining === 0) stockEmptied = true
    }
    used.set(chosen.id, (used.get(chosen.id) ?? 0) + 1)
    consumed.carbs += chosen.carbsG
    consumed.fluid += chosen.volumeMl
    consumed.sodium += chosen.sodiumMg
    consumed.caffeine += chosen.caffeineMg
    intakes.push({
      minute: slot.minute,
      segment: slot.segment.segment,
      productId: chosen.id,
      productName: chosen.name,
      productType: chosen.type,
      quantity: 1,
      carbsG: roundTo(chosen.carbsG, 1),
      fluidMl: Math.round(chosen.volumeMl),
      sodiumMg: Math.round(chosen.sodiumMg),
      caffeineMg: Math.round(chosen.caffeineMg),
      cumulativeCarbsG: roundTo(consumed.carbs, 1),
      cumulativeFluidMl: Math.round(consumed.fluid),
      cumulativeSodiumMg: Math.round(consumed.sodium),
    })
  })

  const totals: PlanTotals = {
    carbsG: roundTo(consumed.carbs, 1),
    fluidMl: Math.round(consumed.fluid),
    sodiumMg: Math.round(consumed.sodium),
    caffeineMg: Math.round(consumed.caffeine),
  }
  const coverage = coverageOf(totals, targets)
  if (targets.carbsG >= nutritionConfig.planner.carbGapG && coverage.carbs < nutritionConfig.planner.coverageThreshold) {
    warnings.push(
      warn('UNDER_CARBS', 'Le plan ne couvre pas la cible de glucides avec le stock disponible.'),
    )
  }
  if (targets.fluidMl >= nutritionConfig.planner.fluidGapMl && coverage.fluid < nutritionConfig.planner.coverageThreshold) {
    warnings.push(warn('UNDER_FLUID', 'Le plan ne couvre pas la cible d’eau avec le stock disponible.'))
  }
  if (
    targets.sodiumMg >= nutritionConfig.planner.sodiumGapMg &&
    coverage.sodium < nutritionConfig.planner.coverageThreshold
  ) {
    warnings.push(
      warn('UNDER_SODIUM', 'Le plan ne couvre pas la cible de sodium avec le stock disponible.'),
    )
  }
  if (stockEmptied && (coverage.carbs < 1 || coverage.fluid < 1 || coverage.sodium < 1)) {
    warnings.push(
      warn('INSUFFICIENT_STOCK', 'Le stock de la Box est épuisé avant d’atteindre les cibles.'),
    )
  }
  if (totals.caffeineMg > nutritionConfig.planner.caffeineCautionMg) {
    warnings.push(
      warn(
        'CAFFEINE_HIGH',
        `La caféine cumulée (${totals.caffeineMg} mg) dépasse ${nutritionConfig.planner.caffeineCautionMg} mg.`,
      ),
    )
  }

  return {
    intakes,
    totals,
    targetsTotal: targets,
    coverage,
    shoppingList: shoppingList(request.products, pool, used, totals, targets),
    segments,
    warnings,
  }
}
