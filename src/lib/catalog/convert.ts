import type { ProductType } from '@/engine/types'
import { PRODUCT_TYPES } from '@/engine/types'

export const OFF_USER_AGENT = 'ravitoBox/2.0 (self-hosted nutrition planner; Open Food Facts import)'

const NAME_MAX = 160
const BRAND_MAX = 80

export interface CategoryRule {
  tag: string
  type: ProductType
  open: boolean
}

export interface BrandRule {
  slug: string
  name: string
}

export interface CatalogDraft {
  name: string
  brand: string | null
  barcode: string
  productType: ProductType
  flavor: null
  carbsG: number
  carbsPer100: number | null
  sugarsG: number | null
  sugarsPer100: number | null
  energyKj: number | null
  energyKjPer100: number | null
  sodiumMg: number | null
  sodiumPer100: number | null
  caffeineMg: number | null
  caffeinePer100: number | null
  servingLabel: string | null
  servingSize: number | null
  servingUnit: 'g' | 'ml' | null
  volumeMl: number | null
  imageUrl: string | null
  imageCredit: string | null
  sourceUrl: string
  dataQuality: 'complete' | 'incomplete'
  offLastModified: string | null
}

export interface RejectedProduct {
  barcode: string
  name: string
  reason: string
}

export type MapOutcome = { ok: true; draft: CatalogDraft } | ({ ok: false } & RejectedProduct)

const PORTION_NOUN: Record<ProductType, string> = {
  gel: 'gel',
  boisson: 'boisson',
  barre: 'barre',
  compote: 'gourde',
  pate_de_fruit: 'pâte',
  capsule_sel: 'dose',
  eau: 'bouteille',
  autre: 'portion',
}

const FOLDED: Record<string, string> = {
  à: 'a', â: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e',
  ï: 'i', î: 'i', ô: 'o', ù: 'u', û: 'u', ü: 'u', ç: 'c', œ: 'o', æ: 'a',
}

export function foldText(value: string): string {
  let folded = ''
  for (const char of value.toLowerCase()) folded += FOLDED[char] ?? char
  return folded
}

export function offNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function parseCategoryRules(text: string): CategoryRule[] {
  const rules: CategoryRule[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [tag, type, mode] = trimmed.split(/\s+/)
    if (!tag || !type || !PRODUCT_TYPES.includes(type as ProductType)) continue
    rules.push({ tag: tag.toLowerCase(), type: type as ProductType, open: mode === 'open' })
  }
  return rules
}

export function slugifyBrand(name: string): string {
  return foldText(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function parseBrandList(text: string): BrandRule[] {
  const rules: BrandRule[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [left, right] = trimmed.split('|')
    const name = (right ?? left).trim()
    const slug = (right ? left : slugifyBrand(name)).trim().toLowerCase()
    if (!name || !slug) continue
    rules.push({ slug, name })
  }
  return rules
}

export function soldInFrance(tags: string[] | undefined): boolean {
  if (!tags || tags.length === 0) return false
  return tags.some((tag) => {
    const folded = tag.toLowerCase()
    return folded === 'en:france' || folded === 'fr:france' || folded === 'france'
  })
}

export function matchCategory(tags: string[] | undefined, rules: CategoryRule[]): CategoryRule | null {
  if (!tags || tags.length === 0) return null
  const set = new Set(tags.map((tag) => tag.toLowerCase()))
  return rules.find((rule) => set.has(rule.tag)) ?? null
}

export function typeFromName(text: string): ProductType | null {
  const folded = foldText(text)
  if (/scoop|poudre|boisson|\bdrink\b|maltodextrine|isoton|iso\+/.test(folded)) return 'boisson'
  if (/\bbarre\b|\bbar\b/.test(folded)) return 'barre'
  if (/chew/.test(folded)) return 'autre'
  if (/compote|gourde|\bpuree\b/.test(folded)) return 'compote'
  if (/pate de fruit/.test(folded)) return 'pate_de_fruit'
  if (/\bgel\b|energix|coup de fouet/.test(folded)) return 'gel'
  if (/capsule|comprime|\bsel\b|electrolyte/.test(folded)) return 'capsule_sel'
  return null
}

export function inferSingleServeGel(text: string, portion: { size: number; unit: 'g' | 'ml' } | null, carbsG: number): boolean {
  if (typeFromName(text)) return false
  if (!portion || portion.unit !== 'g' || portion.size < 20 || portion.size > 80) return false
  return carbsG >= 15
}

export function displayBrand(offBrand: string, rules: BrandRule[]): string {
  const trimmed = offBrand.trim()
  if (!trimmed) return trimmed
  const match = rules
    .filter((rule) => brandMatches(trimmed, [rule]) && foldText(rule.name).includes(foldText(trimmed)) && rule.name.length > trimmed.length)
    .sort((a, b) => b.name.length - a.name.length)[0]
  return match?.name ?? trimmed
}

export function brandMatches(productBrand: string | null, rules: BrandRule[]): boolean {
  if (!productBrand || rules.length === 0) return false
  const tokens = productBrand.split(/[,;/]/).map((part) => foldText(part.trim())).filter(Boolean)
  return rules.some((rule) => {
    const needle = foldText(rule.name)
    if (!needle) return false
    if (needle.length <= 3) return tokens.some((token) => token === needle)
    return tokens.some((token) => token === needle || token.includes(needle) || needle.includes(token))
  })
}

export function parsePortion(raw: string | null | undefined): { size: number; unit: 'g' | 'ml' } | null {
  if (!raw || !raw.trim()) return null
  const matches = [...raw.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/gi)]
  const found = matches[matches.length - 1]
  if (!found || !found[1] || !found[2]) return null
  const amount = Number(found[1].replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) return null
  const unit = found[2].toLowerCase()
  if (unit === 'kg') return { size: roundSize(amount * 1000), unit: 'g' }
  if (unit === 'l') return { size: roundSize(amount * 1000), unit: 'ml' }
  if (unit === 'cl') return { size: roundSize(amount * 10), unit: 'ml' }
  if (unit === 'ml') return { size: roundSize(amount), unit: 'ml' }
  return { size: roundSize(amount), unit: 'g' }
}

function roundSize(value: number): number {
  return Math.round(value * 10) / 10
}

function roundNutrient(value: number): number {
  return Math.round(value * 10) / 10
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value.trim() : ''
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

function barcodeOf(row: Record<string, unknown>): string {
  const code = stringField(row, 'code').replace(/\s/g, '')
  return /^\d{8,14}$/.test(code) ? code : ''
}

function portionFrom(row: Record<string, unknown>): { size: number; unit: 'g' | 'ml' } | null {
  const quantity = offNumber(row.serving_quantity)
  const unit = stringField(row, 'serving_quantity_unit').toLowerCase()
  if (quantity != null && quantity > 0 && quantity <= 5000 && (unit === 'g' || unit === 'ml')) {
    return { size: roundSize(quantity), unit }
  }
  return parsePortion(stringField(row, 'serving_size')) ?? parsePortion(stringField(row, 'quantity'))
}

function perServing(per100: number | null, portion: { size: number; unit: 'g' | 'ml' } | null, servingValue: number | null): number | null {
  if (servingValue != null) return roundNutrient(servingValue)
  if (per100 == null || !portion) return null
  return roundNutrient((per100 * portion.size) / 100)
}

function sodiumPer100(nutriments: Record<string, unknown>): { mg: number | null; negative: boolean } {
  const sodium = offNumber(nutriments.sodium_100g)
  if (sodium != null) {
    if (sodium < 0) return { mg: null, negative: true }
    return { mg: roundNutrient(sodium * 1000), negative: false }
  }
  const salt = offNumber(nutriments.salt_100g)
  if (salt == null) return { mg: null, negative: false }
  if (salt < 0) return { mg: null, negative: true }
  return { mg: roundNutrient((salt / 2.5) * 1000), negative: false }
}

function asMilligrams(value: number, unit: string): number {
  if (unit === 'mg') return value
  if (unit === 'g' || value <= 5) return value * 1000
  return value
}

function caffeinePer100(nutriments: Record<string, unknown>): { mg: number | null; negative: boolean } {
  const raw = offNumber(nutriments.caffeine_100g)
  if (raw == null) return { mg: null, negative: false }
  if (raw < 0) return { mg: null, negative: true }
  return { mg: roundNutrient(asMilligrams(raw, stringField(nutriments, 'caffeine_unit').toLowerCase())), negative: false }
}

function energyPer100(nutriments: Record<string, unknown>): { kj: number | null; negative: boolean } {
  const candidates = [
    offNumber(nutriments['energy-kj_100g']),
    offNumber(nutriments['energy-kcal_100g']) != null ? (offNumber(nutriments['energy-kcal_100g']) as number) * 4.184 : null,
    offNumber(nutriments.energy_100g),
  ]
  for (const value of candidates) {
    if (value == null) continue
    if (value < 0) return { kj: null, negative: true }
    return { kj: roundNutrient(value), negative: false }
  }
  return { kj: null, negative: false }
}

function servingLabel(type: ProductType, portion: { size: number; unit: 'g' | 'ml' } | null): string | null {
  if (!portion) return null
  const size = Number.isInteger(portion.size) ? String(portion.size) : portion.size.toFixed(1)
  return `1 ${PORTION_NOUN[type]} de ${size} ${portion.unit}`
}

function imageCredit(row: Record<string, unknown>): string | null {
  const images = asRecord(row.images)
  const front = images ? asRecord(images.front_fr) ?? asRecord(images.front) : null
  const uploader = front && typeof front.uploader === 'string' ? front.uploader.trim() : ''
  const photographers = stringList(row.photographers)
  const credit = uploader || photographers?.[0]?.trim() || ''
  if (!credit) return 'Contributeurs Open Food Facts'
  return credit.slice(0, 120)
}

function reject(barcode: string, name: string, reason: string): MapOutcome {
  return { ok: false, barcode: barcode || 'sans code', name: name || 'sans nom', reason }
}

export function prepareOffProduct(raw: unknown, rules: CategoryRule[], brands: BrandRule[]): MapOutcome {
  const row = asRecord(raw)
  if (!row) return reject('', '', 'fiche illisible')
  const barcode = barcodeOf(row)
  const name = (stringField(row, 'product_name_fr') || stringField(row, 'product_name')).slice(0, NAME_MAX)
  if (!barcode) return reject(stringField(row, 'code'), name, 'code-barres invalide')
  if (!name) return reject(barcode, '', 'nom absent')
  if (!soldInFrance(stringList(row.countries_tags))) return reject(barcode, name, 'hors France')
  const category = matchCategory(stringList(row.categories_tags), rules)
  const brand = stringField(row, 'brands').slice(0, BRAND_MAX)
  const knownBrand = brandMatches(brand, brands)
  if (!category && !knownBrand) return reject(barcode, name, 'catégorie hors périmètre')
  if (category && !category.open && !knownBrand) return reject(barcode, name, 'marque hors liste')

  const nutriments = asRecord(row.nutriments) ?? {}
  const portion = portionFrom(row) ?? parsePortion(name)
  const carbsPer100 = offNumber(nutriments.carbohydrates_100g)
  const carbsServing = offNumber(nutriments.carbohydrates_serving)
  if ((carbsPer100 != null && carbsPer100 < 0) || (carbsServing != null && carbsServing < 0)) {
    return reject(barcode, name, 'valeur négative')
  }
  if (carbsPer100 != null && carbsPer100 > 100) return reject(barcode, name, 'glucides aberrants')
  const carbsG = perServing(carbsPer100, portion, carbsServing)
  if (carbsG == null) return reject(barcode, name, portion ? 'glucides absents' : 'portion inconnue')
  if (portion && carbsG > portion.size * 1.02) return reject(barcode, name, 'glucides supérieurs à la portion')

  const sugarsPer100 = offNumber(nutriments.sugars_100g)
  const sugarsServing = offNumber(nutriments.sugars_serving)
  if ((sugarsPer100 != null && sugarsPer100 < 0) || (sugarsServing != null && sugarsServing < 0)) {
    return reject(barcode, name, 'valeur négative')
  }
  const sodium = sodiumPer100(nutriments)
  if (sodium.negative) return reject(barcode, name, 'valeur négative')
  const sodiumServing = offNumber(nutriments.sodium_serving)
  if (sodiumServing != null && sodiumServing < 0) return reject(barcode, name, 'valeur négative')
  const caffeine = caffeinePer100(nutriments)
  if (caffeine.negative) return reject(barcode, name, 'valeur négative')
  const caffeineServingRaw = offNumber(nutriments.caffeine_serving)
  if (caffeineServingRaw != null && caffeineServingRaw < 0) return reject(barcode, name, 'valeur négative')
  const caffeineServing = caffeineServingRaw == null
    ? null
    : asMilligrams(caffeineServingRaw, stringField(nutriments, 'caffeine_unit').toLowerCase())
  const energy = energyPer100(nutriments)
  if (energy.negative) return reject(barcode, name, 'valeur négative')

  const sodiumMg = sodium.mg == null && sodiumServing == null
    ? null
    : perServing(sodium.mg, portion, sodiumServing == null ? null : sodiumServing * (sodiumServing <= 5 ? 1000 : 1))
  const caffeineMg = caffeine.mg == null && caffeineServing == null
    ? null
    : perServing(caffeine.mg, portion, caffeineServing)
  const imageUrl = /^https?:\/\//i.test(stringField(row, 'image_front_url')) ? stringField(row, 'image_front_url') : null
  const modified = offNumber(row.last_modified_t)
  const quality = portion && sodiumMg != null && caffeineMg != null ? 'complete' : 'incomplete'
  const source = stringField(row, 'url') || `https://world.openfoodfacts.org/product/${barcode}`
  const described = [name, stringField(row, 'serving_size'), stringField(row, 'quantity')].join(' ')
  const fromName = typeFromName(described)
  const productType = category && category.type !== 'autre'
    ? category.type
    : fromName ?? category?.type ?? (inferSingleServeGel(described, portion, carbsG) ? 'gel' : 'autre')

  return {
    ok: true,
    draft: {
      name,
      brand: displayBrand(brand, brands).slice(0, BRAND_MAX),
      barcode,
      productType,
      flavor: null,
      carbsG,
      carbsPer100: carbsPer100 == null ? null : roundNutrient(carbsPer100),
      sugarsG: perServing(sugarsPer100, portion, sugarsServing),
      sugarsPer100: sugarsPer100 == null ? null : roundNutrient(sugarsPer100),
      energyKj: perServing(energy.kj, portion, offNumber(nutriments['energy-kj_serving'])),
      energyKjPer100: energy.kj,
      sodiumMg,
      sodiumPer100: sodium.mg,
      caffeineMg,
      caffeinePer100: caffeine.mg,
      servingLabel: servingLabel(productType, portion),
      servingSize: portion?.size ?? null,
      servingUnit: portion?.unit ?? null,
      volumeMl: portion?.unit === 'ml' ? portion.size : null,
      imageUrl,
      imageCredit: imageUrl ? imageCredit(row) : null,
      sourceUrl: source,
      dataQuality: quality,
      offLastModified: modified == null ? null : new Date(modified * 1000).toISOString(),
    },
  }
}

export function readDump(text: string): { rows: unknown[]; brokenLines: number } {
  const rows: unknown[] = []
  let brokenLines = 0
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      rows.push(JSON.parse(trimmed) as unknown)
    } catch {
      brokenLines += 1
    }
  }
  return { rows, brokenLines }
}

function modifiedOf(row: Record<string, unknown>): number {
  return offNumber(row.last_modified_t) ?? 0
}

export function dedupeRaw(rows: unknown[]): unknown[] {
  const kept = new Map<string, { row: unknown; modified: number; index: number }>()
  const passthrough: unknown[] = []
  rows.forEach((row, index) => {
    const record = asRecord(row)
    if (!record) {
      passthrough.push(row)
      return
    }
    const barcode = barcodeOf(record)
    if (!barcode) {
      passthrough.push(row)
      return
    }
    const modified = modifiedOf(record)
    const previous = kept.get(barcode)
    if (!previous || modified >= previous.modified) kept.set(barcode, { row, modified, index })
  })
  return [...passthrough, ...[...kept.values()].sort((a, b) => a.index - b.index).map((item) => item.row)]
}

export function buildDrafts(
  rows: unknown[],
  rules: CategoryRule[],
  brands: BrandRule[],
  limit: number,
): { drafts: CatalogDraft[]; rejected: RejectedProduct[] } {
  const capped = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0
  const drafts: CatalogDraft[] = []
  const rejected: RejectedProduct[] = []
  for (const row of dedupeRaw(rows)) {
    if (drafts.length >= capped) break
    const outcome = prepareOffProduct(row, rules, brands)
    if (!outcome.ok) {
      rejected.push({ barcode: outcome.barcode, name: outcome.name, reason: outcome.reason })
      continue
    }
    drafts.push(outcome.draft)
  }
  return { drafts, rejected }
}

export function decideUpsert(existing: { verified: boolean } | null): 'insert' | 'update' | 'skip_verified' {
  if (!existing) return 'insert'
  if (existing.verified) return 'skip_verified'
  return 'update'
}
