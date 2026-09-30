import type { ProductType } from '@/engine/types'
import { PRODUCT_TYPES } from '@/engine/types'
import { foldText } from '@/lib/catalog/convert'

export interface CatalogItem {
  id: string
  name: string
  brand: string | null
  type: ProductType
  flavor: string | null
  carbsG: number | null
  sodiumMg: number | null
  caffeineMg: number | null
  verified: boolean
  inBox: boolean
}

export interface CatalogQuery {
  text: string
  type: string | null
  brand: string
  flavor: string
  carbsMin: number | null
  carbsMax: number | null
  hasSodium: boolean
  hasCaffeine: boolean
  verifiedOnly: boolean
  inBoxOnly: boolean
  sort: 'name' | 'brand' | 'carbs' | string
  page: number
  pageSize: number
}

export function diceCoefficient(left: string, right: string): number {
  const a = foldText(left)
  const b = foldText(right)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const grams = new Map<string, number>()
  for (let index = 0; index < a.length - 1; index += 1) {
    const gram = a.slice(index, index + 2)
    grams.set(gram, (grams.get(gram) ?? 0) + 1)
  }
  let shared = 0
  for (let index = 0; index < b.length - 1; index += 1) {
    const gram = b.slice(index, index + 2)
    const count = grams.get(gram) ?? 0
    if (count > 0) {
      grams.set(gram, count - 1)
      shared += 1
    }
  }
  return (2 * shared) / (a.length - 1 + (b.length - 1))
}

export function loose(value: string): string {
  return foldText(value).replace(/(.)\1+/g, '$1')
}

export function typeSearchLabel(type: ProductType): string {
  if (type === 'pate_de_fruit') return 'pate de fruits'
  if (type === 'capsule_sel') return 'capsule sel'
  if (type === 'autre') return ''
  return type
}

function wordsOf(value: string): string[] {
  return foldText(value).replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(Boolean)
}

export function textMatches(name: string, brand: string | null, query: string): boolean {
  const needle = query.trim()
  if (!needle) return true
  const words = wordsOf(`${name} ${brand ?? ''}`)
  return wordsOf(needle).every((token) => words.some((word) => {
    if (word === token) return true
    const squeezed = token.replace(/(.)\1+/g, '$1')
    if (squeezed.length >= 4 && word === squeezed) return true
    return token.length >= 5 && diceCoefficient(word, token) >= 0.55
  }))
}

export function normalizeQuery(query: Partial<CatalogQuery>): CatalogQuery {
  const type = query.type && PRODUCT_TYPES.includes(query.type as ProductType) ? query.type : ''
  const sort = query.sort === 'carbs' || query.sort === 'brand' || query.sort === 'name' ? query.sort : 'name'
  const pageSize = Math.min(48, Math.max(1, Math.floor(query.pageSize ?? 24) || 1))
  const page = Math.max(1, Math.floor(query.page ?? 1) || 1)
  return {
    text: query.text ?? '',
    type,
    brand: query.brand ?? '',
    flavor: query.flavor ?? '',
    carbsMin: finiteOrNull(query.carbsMin),
    carbsMax: finiteOrNull(query.carbsMax),
    hasSodium: Boolean(query.hasSodium),
    hasCaffeine: Boolean(query.hasCaffeine),
    verifiedOnly: Boolean(query.verifiedOnly),
    inBoxOnly: Boolean(query.inBoxOnly),
    sort,
    page,
    pageSize,
  }
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function searchCatalog(items: CatalogItem[], raw: Partial<CatalogQuery>): { items: CatalogItem[]; total: number; page: number; pageSize: number } {
  const query = normalizeQuery(raw)
  const filtered = items.filter((item) => {
    if (query.type && item.type !== query.type) return false
    if (query.brand && !textMatches(item.brand ?? '', null, query.brand)) return false
    if (query.flavor && !textMatches(item.flavor ?? '', null, query.flavor)) return false
    if (!textMatches(`${item.name} ${typeSearchLabel(item.type)}`, item.brand, query.text)) return false
    if (query.carbsMin != null && (item.carbsG == null || item.carbsG < query.carbsMin)) return false
    if (query.carbsMax != null && (item.carbsG == null || item.carbsG > query.carbsMax)) return false
    if (query.hasSodium && item.sodiumMg == null) return false
    if (query.hasCaffeine && item.caffeineMg == null) return false
    if (query.verifiedOnly && !item.verified) return false
    if (query.inBoxOnly && !item.inBox) return false
    return true
  })
  const sorted = [...filtered].sort((a, b) => compareItems(a, b, query.sort))
  const start = (query.page - 1) * query.pageSize
  return { items: sorted.slice(start, start + query.pageSize), total: sorted.length, page: query.page, pageSize: query.pageSize }
}

function compareItems(a: CatalogItem, b: CatalogItem, sort: CatalogQuery['sort']): number {
  if (sort === 'carbs') {
    const left = a.carbsG ?? Number.POSITIVE_INFINITY
    const right = b.carbsG ?? Number.POSITIVE_INFINITY
    if (left !== right) return left - right
  }
  if (sort === 'brand') {
    const byBrand = foldText(a.brand ?? '').localeCompare(foldText(b.brand ?? ''), 'fr')
    if (byBrand !== 0) return byBrand
  }
  const byName = foldText(a.name).localeCompare(foldText(b.name), 'fr')
  if (byName !== 0) return byName
  return a.id.localeCompare(b.id)
}

export function toSearchRpc(query: Partial<CatalogQuery>, scope: 'catalog' | 'custom' | 'all' = 'catalog', review = false) {
  const normalized = normalizeQuery(query)
  return {
    q: normalized.text,
    p_type: normalized.type || null,
    p_brand: normalized.brand,
    p_flavor: normalized.flavor,
    p_carbs_min: normalized.carbsMin,
    p_carbs_max: normalized.carbsMax,
    p_has_sodium: normalized.hasSodium,
    p_has_caffeine: normalized.hasCaffeine,
    p_verified_only: normalized.verifiedOnly,
    p_in_box: normalized.inBoxOnly,
    p_review: review,
    p_scope: scope,
    p_sort: normalized.sort,
    p_limit: normalized.pageSize,
    p_offset: (normalized.page - 1) * normalized.pageSize,
  }
}

export function parseSearchPayload(data: unknown): { total: number; items: Record<string, unknown>[] } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { total: 0, items: [] }
  const record = data as { total?: unknown; items?: unknown }
  const total = typeof record.total === 'number' && Number.isFinite(record.total) && record.total >= 0 ? Math.floor(record.total) : 0
  if (!Array.isArray(record.items)) return { total, items: [] }
  return {
    total,
    items: record.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)),
  }
}
