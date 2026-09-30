import { describe, expect, it } from 'vitest'
import { nutritionConfig } from '@/engine/config'
import { SPORTS } from '@/engine'
import { buildPlan, buildSegments } from '@/engine/planner'
import { computeTargets, presetTriathlon } from '@/engine/targets'
import { formatMinute, formatPlanText } from '@/engine/text'
import { INTENSITIES, PRODUCT_TYPES, SEGMENTS, SESSION_TYPES, SWEAT_LEVELS, TEMPERATURES, TRI_FORMATS } from '@/engine/types'
import type { OutingInput, PlannerProduct, ProductType, TriFormat } from '@/engine/types'
import type { PlanRequest } from '@/engine/planner'

function outing(overrides: Partial<OutingInput> = {}): OutingInput {
  return {
    sport: 'course',
    sessionType: 'course_intermediaire',
    durationMinutes: 180,
    intensity: 'moderee',
    temperature: 'temperee',
    sweat: 'moyenne',
    toleranceGPerHour: 120,
    ...overrides,
  }
}

function product(overrides: Partial<PlannerProduct> = {}): PlannerProduct {
  return {
    id: 'gel',
    name: 'Gel',
    type: 'gel',
    flavor: 'citron',
    carbsG: 22,
    sodiumMg: 40,
    caffeineMg: 0,
    volumeMl: 0,
    stock: 30,
    inBox: true,
    ...overrides,
  }
}

function pantry(): PlannerProduct[] {
  return [
    product({ id: 'gel', name: 'Gel agrume', type: 'gel', flavor: 'agrume', carbsG: 22, sodiumMg: 50 }),
    product({ id: 'drink', name: 'Boisson citron', type: 'boisson', flavor: 'citron', carbsG: 36, sodiumMg: 320, volumeMl: 500 }),
    product({ id: 'bar', name: 'Barre', type: 'barre', flavor: 'chocolat', carbsG: 28, sodiumMg: 70 }),
    product({ id: 'compote', name: 'Compote', type: 'compote', flavor: 'pomme', carbsG: 18, sodiumMg: 10, volumeMl: 90 }),
    product({ id: 'pate', name: 'Pâte', type: 'pate_de_fruit', flavor: 'abricot', carbsG: 20, sodiumMg: 5 }),
    product({ id: 'banana', name: 'Banane', type: 'autre', flavor: 'banane', carbsG: 23, sodiumMg: 1 }),
    product({ id: 'water', name: 'Eau', type: 'eau', flavor: 'neutre', carbsG: 0, sodiumMg: 0, volumeMl: 500 }),
    product({ id: 'salt', name: 'Capsule', type: 'capsule_sel', flavor: 'neutre', carbsG: 0, sodiumMg: 400, volumeMl: 0 }),
  ]
}

function request(overrides: Partial<PlanRequest> = {}, outingOverrides: Partial<OutingInput> = {}): PlanRequest {
  const base = outing({ ...outingOverrides, durationMinutes: overrides.durationMinutes ?? outingOverrides.durationMinutes ?? 180 })
  const targets = computeTargets(base)
  return {
    sport: base.sport,
    durationMinutes: base.durationMinutes,
    targets,
    products: pantry(),
    allowOutsideBox: false,
    triathlon: base.triathlon,
    ...overrides,
  }
}

function gaps(minutes: number[]) {
  return minutes.slice(1).map((minute, index) => minute - (minutes[index] ?? 0))
}

describe('buildPlan', () => {
  it('expose les sports du moteur', () => {
    expect(SPORTS).toContain('triathlon')
    expect(SESSION_TYPES).toHaveLength(3)
    expect(INTENSITIES).toContain('moderee')
    expect(TEMPERATURES).toContain('chaude')
    expect(SWEAT_LEVELS).toContain('elevee')
    expect(PRODUCT_TYPES).toContain('gel')
    expect(TRI_FORMATS).toContain('ironman')
    expect(SEGMENTS).toContain('velo')
  })

  it('construit un plan de 3 h varié, espacé, dont les cumuls collent aux totaux', () => {
    const plan = buildPlan(request())
    expect(plan.intakes.length).toBeGreaterThan(4)
    const minutes = plan.intakes.map((intake) => intake.minute)
    expect(Math.min(...gaps(minutes))).toBeGreaterThanOrEqual(nutritionConfig.planner.minSpacingMinutes)
    const kinds = new Set(plan.intakes.map((intake) => intake.productType))
    expect(kinds.has('gel') || kinds.has('barre') || kinds.has('compote')).toBe(true)
    expect(kinds.has('boisson') || kinds.has('eau')).toBe(true)
    const last = plan.intakes[plan.intakes.length - 1]
    expect(last?.cumulativeCarbsG).toBe(plan.totals.carbsG)
    expect(last?.cumulativeFluidMl).toBe(plan.totals.fluidMl)
    expect(last?.cumulativeSodiumMg).toBe(plan.totals.sodiumMg)
    expect(plan.coverage.carbs).toBeGreaterThanOrEqual(nutritionConfig.planner.coverageThreshold)
    const brought = plan.shoppingList.reduce((sum, line) => sum + line.toBring, 0)
    expect(brought).toBe(plan.intakes.length)
  })

  it('couvre chaque sport hors triathlon', () => {
    for (const sport of ['course', 'trail', 'cyclisme'] as const) {
      const plan = buildPlan(request({ sport }, { sport }))
      expect(plan.intakes.length).toBeGreaterThan(0)
      expect(plan.intakes.every((intake) => intake.segment === 'effort')).toBe(true)
      expect(plan.intakes.every((intake) => intake.minute < 180)).toBe(true)
    }
  })

  it('change les cibles selon le type de sortie, la température et la sudation', () => {
    const train = buildPlan(request({}, { sessionType: 'entrainement' }))
    const race = buildPlan(request({}, { sessionType: 'objectif_principal' }))
    expect(train.targetsTotal.carbsG).toBeGreaterThan(race.targetsTotal.carbsG)
    const cool = buildPlan(request({}, { temperature: 'fraiche', sweat: 'faible' }))
    const hot = buildPlan(request({}, { temperature: 'chaude', sweat: 'elevee' }))
    expect(hot.targetsTotal.fluidMl).toBeGreaterThan(cool.targetsTotal.fluidMl)
    expect(hot.targetsTotal.sodiumMg).toBeGreaterThan(cool.targetsTotal.sodiumMg)
  })

  it('reste vide et prévient si la durée est nulle, négative ou absurde', () => {
    for (const durationMinutes of [0, -30, Number.NaN]) {
      const plan = buildPlan(request({ durationMinutes }))
      expect(plan.intakes).toEqual([])
      expect(plan.warnings.map((warning) => warning.code)).toContain('INVALID_DURATION')
    }
  })

  it('ne force pas de prise sur une sortie trop courte pour ouvrir une fenêtre', () => {
    const plan = buildPlan(request({ durationMinutes: 10 }, { durationMinutes: 10 }))
    expect(plan.intakes).toEqual([])
    expect(plan.warnings.map((warning) => warning.code)).not.toContain('UNDER_CARBS')
  })

  it('tient une sortie très longue sans rapprocher les prises', () => {
    const plan = buildPlan(
      request(
        {
          durationMinutes: 12 * 60,
          products: pantry().map((item) => ({ ...item, stock: 80 })),
        },
        { durationMinutes: 12 * 60 },
      ),
    )
    expect(plan.intakes.length).toBeGreaterThan(15)
    expect(Math.min(...gaps(plan.intakes.map((intake) => intake.minute)))).toBeGreaterThanOrEqual(15)
    expect(plan.intakes.every((intake) => intake.minute < 12 * 60)).toBe(true)
  })

  it('prévient si la Box est vide, tout est exclu, ou le stock est à zéro', () => {
    expect(buildPlan(request({ products: [] })).warnings.map((warning) => warning.code)).toContain('EMPTY_BOX')
    const excluded = buildPlan(
      request({ products: pantry().map((item) => ({ ...item, excluded: true })) }),
    )
    expect(excluded.warnings.map((warning) => warning.code)).toContain('ALL_EXCLUDED')
    expect(excluded.intakes).toEqual([])
    const emptyStock = buildPlan(request({ products: pantry().map((item) => ({ ...item, stock: 0 })) }))
    expect(emptyStock.warnings.map((warning) => warning.code)).toContain('INSUFFICIENT_STOCK')
    const negativeStock = buildPlan(request({ products: [product({ stock: -3 })] }))
    expect(negativeStock.intakes).toEqual([])
  })

  it('ignore les produits hors Box tant que ce n’est pas autorisé', () => {
    const outside = product({ id: 'ext', name: 'Gel extérieur', inBox: false, stock: null })
    const blocked = buildPlan(request({ products: [outside], allowOutsideBox: false }))
    expect(blocked.warnings.map((warning) => warning.code)).toContain('OUTSIDE_BOX_DISABLED')
    const opened = buildPlan(request({ products: [outside], allowOutsideBox: true }))
    expect(opened.intakes.length).toBeGreaterThan(0)
    expect(opened.shoppingList.every((line) => line.inBox === false && line.missing >= line.toBring)).toBe(true)
  })

  it('utilise un seul produit jusqu’au stock, puis signale le manque', () => {
    const only = product({ id: 'only', name: 'Seul gel', stock: 2, carbsG: 22, sodiumMg: 10, volumeMl: 0 })
    const plan = buildPlan(request({ products: [only] }))
    expect(plan.intakes).toHaveLength(2)
    expect(plan.intakes.every((intake) => intake.productId === 'only')).toBe(true)
    expect(plan.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['UNDER_CARBS', 'UNDER_FLUID', 'UNDER_SODIUM', 'INSUFFICIENT_STOCK']),
    )
    const line = plan.shoppingList.find((item) => item.productId === 'only')
    expect(line?.toBring).toBe(2)
    expect(line?.missing).toBeGreaterThan(0)
  })

  it('n’emploie pas un produit sans aucun apport et peut ignorer un produit exclu', () => {
    const useless = product({
      id: 'vide',
      name: 'Vide',
      type: 'autre',
      carbsG: -4,
      sodiumMg: Number.NaN,
      caffeineMg: -1,
      volumeMl: -5,
      stock: 5,
    })
    const uselessPlan = buildPlan(request({ products: [useless] }))
    expect(uselessPlan.intakes).toEqual([])
    expect(uselessPlan.warnings.map((warning) => warning.code)).toContain('UNDER_CARBS')
    const mixed = buildPlan(
      request({
        products: [product({ id: 'keep', name: 'Gardé' }), product({ id: 'drop', name: 'Exclu', excluded: true, carbsG: 40 })],
      }),
    )
    expect(mixed.intakes.every((intake) => intake.productId !== 'drop')).toBe(true)
  })

  it('préfère la saveur aimée, le favori, puis l’identifiant le plus petit', () => {
    const preferred = buildPlan(
      request({
        products: [
          product({ id: 'b', name: 'B', carbsG: 25, preferredFlavor: false, favorite: false }),
          product({ id: 'a', name: 'A', carbsG: 25, preferredFlavor: true, favorite: false }),
        ],
      }),
    )
    expect(preferred.intakes[0]?.productId).toBe('a')
    const favorite = buildPlan(
      request({
        products: [
          product({ id: 'b', name: 'B', carbsG: 25, favorite: false }),
          product({ id: 'a', name: 'A', carbsG: 25, favorite: true }),
        ],
      }),
    )
    expect(favorite.intakes[0]?.productId).toBe('a')
    const tie = buildPlan(
      request({
        products: [
          product({ id: 'b', name: 'B', carbsG: 25 }),
          product({ id: 'a', name: 'A', carbsG: 25 }),
        ],
      }),
    )
    expect(tie.intakes[0]?.productId).toBe('a')
  })

  it('prévient quand la caféine cumulée devient haute', () => {
    const plan = buildPlan(
      request({
        products: [product({ id: 'cafe', name: 'Gel café', caffeineMg: 80, carbsG: 22, stock: 12 })],
      }),
    )
    expect(plan.totals.caffeineMg).toBeGreaterThan(nutritionConfig.planner.caffeineCautionMg)
    expect(plan.warnings.map((warning) => warning.code)).toContain('CAFFEINE_HIGH')
  })

  it('peut couvrir les cibles sans crier au stock épuisé quand il est juste suffisant', () => {
    const plan = buildPlan(
      request({
        durationMinutes: 60,
        products: [
          product({
            id: 'drink',
            name: 'Boisson',
            type: 'boisson',
            carbsG: 45,
            sodiumMg: 600,
            volumeMl: 600,
            stock: 2,
          }),
        ],
      }, { durationMinutes: 60 }),
    )
    expect(plan.coverage.carbs).toBeGreaterThanOrEqual(1)
    expect(plan.coverage.fluid).toBeGreaterThanOrEqual(1)
    expect(plan.coverage.sodium).toBeGreaterThanOrEqual(1)
    expect(plan.warnings.map((warning) => warning.code)).not.toContain('INSUFFICIENT_STOCK')
  })

  it('place du sel quand le sodium reste en retard', () => {
    const plan = buildPlan(
      request({
        products: [
          product({ id: 'gel', name: 'Gel', carbsG: 25, sodiumMg: 20, stock: 20 }),
          product({ id: 'salt', name: 'Sel', type: 'capsule_sel', carbsG: 0, sodiumMg: 400, volumeMl: 0, stock: 10 }),
          product({ id: 'water', name: 'Eau', type: 'eau', carbsG: 0, sodiumMg: 0, volumeMl: 500, stock: 10 }),
        ],
      }),
    )
    expect(plan.intakes.some((intake) => intake.productType === 'capsule_sel')).toBe(true)
  })

  it('découpe chaque format de triathlon sans ravitailler à la nage ni en transition', () => {
    const formats: TriFormat[] = ['sprint', 'olympique', 'triathlon_70_3', 'ironman', 'personnalise']
    for (const format of formats) {
      const tri = presetTriathlon(format)
      const total = tri.swimMin + tri.t1Min + tri.bikeMin + tri.t2Min + tri.runMin
      const plan = buildPlan(
        request(
          {
            sport: 'triathlon',
            durationMinutes: total,
            triathlon: tri,
            products: pantry().map((item) => ({ ...item, stock: 40 })),
          },
          { sport: 'triathlon', durationMinutes: total, triathlon: tri },
        ),
      )
      expect(plan.segments.map((segment) => segment.segment)).toEqual([
        'natation',
        't1',
        'velo',
        't2',
        'course_a_pied',
      ])
      const swimEnd = tri.swimMin + tri.t1Min
      const bikeEnd = swimEnd + tri.bikeMin
      const runStart = bikeEnd + tri.t2Min
      expect(plan.intakes.every((intake) => intake.minute >= swimEnd)).toBe(true)
      expect(
        plan.intakes.every(
          (intake) =>
            (intake.segment === 'velo' && intake.minute < bikeEnd) ||
            (intake.segment === 'course_a_pied' && intake.minute >= runStart),
        ),
      ).toBe(true)
      expect(plan.intakes.some((intake) => intake.segment === 'natation')).toBe(false)
      expect(plan.intakes.some((intake) => intake.segment === 't1' || intake.segment === 't2')).toBe(false)
      const bike = plan.segments.find((segment) => segment.segment === 'velo')
      const run = plan.segments.find((segment) => segment.segment === 'course_a_pied')
      expect(bike?.carbRateGPerHour).toBeGreaterThan(run?.carbRateGPerHour ?? 0)
    }
  })

  it('plafonne le vélo, isole la course à pied, et accepte un vélo seul', () => {
    const capped = buildPlan(
      request(
        {
          sport: 'triathlon',
          durationMinutes: 120,
          triathlon: { format: 'personnalise', swimMin: 0, t1Min: 0, bikeMin: 60, t2Min: 0, runMin: 60 },
        },
        {
          sport: 'triathlon',
          durationMinutes: 120,
          carbOverrideGPerHour: 140,
          toleranceGPerHour: 160,
          allowExceedTolerance: true,
          triathlon: { format: 'personnalise', swimMin: 0, t1Min: 0, bikeMin: 60, t2Min: 0, runMin: 60 },
        },
      ),
    )
    expect(capped.warnings.map((warning) => warning.code)).toContain('BIKE_RATE_CAPPED')
    expect(capped.segments.find((segment) => segment.segment === 'velo')?.carbRateGPerHour).toBe(
      nutritionConfig.planner.triathlon.maxInstantCarbRate,
    )
    const runOnly = buildPlan(
      request(
        {
          sport: 'triathlon',
          durationMinutes: 70,
          triathlon: { format: 'personnalise', swimMin: 10, t1Min: 2, bikeMin: 0, t2Min: 2, runMin: 50 },
        },
        {
          sport: 'triathlon',
          durationMinutes: 64,
          triathlon: { format: 'personnalise', swimMin: 10, t1Min: 2, bikeMin: 0, t2Min: 2, runMin: 50 },
        },
      ),
    )
    expect(runOnly.warnings.map((warning) => warning.code)).toContain('RUN_ONLY_REDUCED')
    expect(runOnly.intakes.every((intake) => intake.segment === 'course_a_pied')).toBe(true)
    const bikeOnly = buildSegments(
      request(
        {
          sport: 'triathlon',
          durationMinutes: 40,
          triathlon: { format: 'personnalise', swimMin: 0, t1Min: 0, bikeMin: 40, t2Min: 0, runMin: 0 },
        },
        { sport: 'triathlon', durationMinutes: 40, triathlon: { format: 'personnalise', swimMin: 0, t1Min: 0, bikeMin: 40, t2Min: 0, runMin: 0 } },
      ),
    )
    expect(bikeOnly.segments.find((segment) => segment.segment === 'velo')?.carbRateGPerHour).toBeGreaterThan(0)
    expect(bikeOnly.warnings).toEqual([])
  })

  it('ramène les segments invalides à zéro et espace les prises autour d’une course courte', () => {
    const broken = buildPlan(
      request(
        {
          sport: 'triathlon',
          durationMinutes: 80,
          triathlon: { format: 'personnalise', swimMin: -8, t1Min: 0, bikeMin: 50, t2Min: Number.NaN, runMin: 15 },
        },
        {
          sport: 'triathlon',
          durationMinutes: 65,
          triathlon: { format: 'personnalise', swimMin: -8, t1Min: 0, bikeMin: 50, t2Min: Number.NaN, runMin: 15 },
        },
      ),
    )
    expect(broken.warnings.map((warning) => warning.code)).toContain('INVALID_SEGMENT')
    expect(Math.min(...gaps(broken.intakes.map((intake) => intake.minute)))).toBeGreaterThanOrEqual(15)
  })

  it('suggère un produit non utilisé quand il comble mieux le manque', () => {
    const plan = buildPlan(
      request(
        {
          durationMinutes: 45,
          products: [
            product({ id: 'gel', name: 'Petit gel', carbsG: 2, sodiumMg: 1, volumeMl: 0, stock: 4 }),
            product({ id: 'bar', name: 'Grosse barre', type: 'barre', carbsG: 40, sodiumMg: 1, volumeMl: 0, stock: 4 }),
            product({ id: 'water', name: 'Eau', type: 'eau', carbsG: 0, sodiumMg: 0, volumeMl: 500, stock: 4 }),
          ],
        },
        { durationMinutes: 45 },
      ),
    )
    const bar = plan.shoppingList.find((line) => line.productId === 'bar')
    expect(bar?.toBring).toBe(0)
    expect(bar?.missing).toBeGreaterThan(0)
  })

  it('distingue un stock vide selon que les glucides, l’eau ou le sodium manquent', () => {
    const lowCarb = buildPlan(
      request(
        {
          durationMinutes: 45,
          products: [product({ id: 'gel', name: 'Gel', carbsG: 22, sodiumMg: 0, volumeMl: 0, stock: 1 })],
        },
        { durationMinutes: 45 },
      ),
    )
    expect(lowCarb.coverage.carbs).toBeGreaterThanOrEqual(1)
    expect(lowCarb.coverage.fluid).toBeLessThan(1)
    expect(lowCarb.warnings.map((warning) => warning.code)).toContain('INSUFFICIENT_STOCK')

    const saltyGap = buildPlan(
      request(
        {
          durationMinutes: 45,
          products: [
            product({
              id: 'drink',
              name: 'Boisson',
              type: 'boisson',
              carbsG: 20,
              sodiumMg: 0,
              volumeMl: 500,
              stock: 1,
            }),
          ],
        },
        { durationMinutes: 45 },
      ),
    )
    expect(saltyGap.coverage.carbs).toBeGreaterThanOrEqual(1)
    expect(saltyGap.coverage.fluid).toBeGreaterThanOrEqual(1)
    expect(saltyGap.coverage.sodium).toBeLessThan(1)
    expect(saltyGap.warnings.map((warning) => warning.code)).toContain('INSUFFICIENT_STOCK')

    const covered = buildPlan(
      request(
        {
          durationMinutes: 45,
          products: [
            product({
              id: 'drink',
              name: 'Boisson complète',
              type: 'boisson',
              carbsG: 20,
              sodiumMg: 400,
              volumeMl: 500,
              stock: 1,
            }),
          ],
        },
        { durationMinutes: 45 },
      ),
    )
    expect(covered.coverage.carbs).toBeGreaterThanOrEqual(1)
    expect(covered.coverage.fluid).toBeGreaterThanOrEqual(1)
    expect(covered.coverage.sodium).toBeGreaterThanOrEqual(1)
    expect(covered.warnings.map((warning) => warning.code)).not.toContain('INSUFFICIENT_STOCK')
  })

  it('accepte un stock nul explicite sur un produit hors calcul fini', () => {
    const plan = buildPlan(
      request({
        products: [product({ id: 'ghost', name: 'Fantôme', stock: null, inBox: true })],
      }),
    )
    expect(plan.intakes).toEqual([])
    expect(plan.warnings.map((warning) => warning.code)).toContain('INSUFFICIENT_STOCK')
  })

  it('ignore les glucides inconnus et signale un produit non vérifié', () => {
    const unknown = product({ id: 'inconnu', name: 'Inconnu', carbsKnown: false, inBox: true, stock: 4 })
    const used = product({
      id: 'gel-off',
      name: 'Gel importé',
      brand: 'Maison',
      imagePath: 'catalog/1.webp',
      verified: false,
      sodiumKnown: false,
      caffeineKnown: false,
      stock: 6,
    })
    const plan = buildPlan(request({ products: [unknown, used], durationMinutes: 90 }))
    expect(plan.intakes.some((intake) => intake.productId === 'inconnu')).toBe(false)
    expect(plan.intakes.some((intake) => intake.productId === 'gel-off')).toBe(true)
    const codes = plan.warnings.map((warning) => warning.code)
    expect(codes).toContain('UNKNOWN_CARBS')
    expect(codes).toContain('UNVERIFIED_PRODUCT')
    expect(codes).toContain('UNKNOWN_SODIUM')
    expect(codes).toContain('UNKNOWN_CAFFEINE')
    const line = plan.shoppingList.find((item) => item.productId === 'gel-off')
    expect(line?.brand).toBe('Maison')
    expect(line?.imagePath).toBe('catalog/1.webp')
    const onlyUnknown = buildPlan(request({ products: [unknown], durationMinutes: 60 }))
    expect(onlyUnknown.intakes).toEqual([])
    expect(onlyUnknown.warnings.map((warning) => warning.code)).toContain('UNKNOWN_CARBS')
  })
})

describe('formatPlanText', () => {
  it('décrit un plan, une liste de courses et les avertissements', () => {
    const plan = buildPlan(request())
    const text = formatPlanText('  Sortie du dimanche  ', plan)
    expect(text).toContain('Sortie du dimanche')
    expect(text).toContain('Glucides')
    expect(text).toContain('À emporter')
    expect(text).toContain('diététicien')
    expect(formatMinute(0)).toBe('0:00')
    expect(formatMinute(65)).toBe('1:05')
    expect(formatMinute(-4)).toBe('0:00')
    expect(formatMinute(Number.NaN)).toBe('0:00')
  })

  it('décrit un plan vide et un titre manquant', () => {
    const plan = buildPlan(request({ products: [], durationMinutes: 30 }))
    const text = formatPlanText('   ', plan)
    expect(text.startsWith('Plan ravitoBox')).toBe(true)
    expect(text).toContain('Aucune prise planifiée.')
    expect(text).toContain('Avertissements')
  })

  it('nomme le segment sur un triathlon et omet la section manque si le stock suffit', () => {
    const tri = presetTriathlon('sprint')
    const total = tri.swimMin + tri.t1Min + tri.bikeMin + tri.t2Min + tri.runMin
    const rich: PlannerProduct[] = (['gel', 'boisson', 'barre', 'eau', 'capsule_sel'] as ProductType[]).map(
      (type, index) =>
        product({
          id: `${type}-${index}`,
          name: type,
          type,
          carbsG: type === 'eau' || type === 'capsule_sel' ? 0 : 40,
          sodiumMg: type === 'capsule_sel' ? 500 : 400,
          volumeMl: type === 'boisson' || type === 'eau' ? 700 : 0,
          stock: 8,
        }),
    )
    const plan = buildPlan(
      request(
        { sport: 'triathlon', durationMinutes: total, triathlon: tri, products: rich },
        { sport: 'triathlon', durationMinutes: total, triathlon: tri, toleranceGPerHour: 200 },
      ),
    )
    const text = formatPlanText('Sprint', plan)
    expect(text).toContain('[velo]')
    if (plan.shoppingList.every((line) => line.missing === 0)) {
      expect(text).not.toContain('Manque dans la Box')
    }
  })
})
