import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildDrafts,
  OFF_USER_AGENT,
  parseBrandList,
  parseCategoryRules,
  readDump,
  type CatalogDraft,
} from '../../src/lib/catalog/convert.ts'
import { createOffClient } from '../../src/lib/catalog/off.ts'
import { draftToPayload } from '../../src/lib/catalog/payload.ts'
import { emptyReport, formatReport, recordUpsert, type ImportReport } from '../../src/lib/catalog/report.ts'
import { toWebpSizes } from './resize.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const here = dirname(fileURLToPath(import.meta.url))

function loadEnv(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq)
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1)
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function diskCache(directory: string) {
  mkdirSync(directory, { recursive: true })
  const cache = new Map<string, string>()
  for (const file of readdirSync(directory)) {
    if (!file.endsWith('.json')) continue
    try {
      const parsed = JSON.parse(readFileSync(resolve(directory, file), 'utf8')) as { url?: string; body?: string }
      if (parsed.url && typeof parsed.body === 'string') cache.set(parsed.url, parsed.body)
    } catch {
      /* cache illisible : ignoré */
    }
  }
  return {
    cache,
    save() {
      for (const [url, body] of cache) {
        if (!url.startsWith('http')) continue
        const name = `${createHash('sha1').update(url).digest('hex')}.json`
        writeFileSync(resolve(directory, name), JSON.stringify({ url, body }))
      }
    },
  }
}

async function rowsFromApi(
  brands: ReturnType<typeof parseBrandList>,
  rules: ReturnType<typeof parseCategoryRules>,
  limit: number,
  report: ImportReport,
) {
  const directory = resolve(root, '.cache/off')
  const stored = diskCache(directory)
  const client = createOffClient({ cache: stored.cache, minIntervalMs: 1000 })
  const rows: unknown[] = []
  const fields = [
    'code', 'product_name', 'product_name_fr', 'brands', 'nutriments', 'serving_size',
    'serving_quantity', 'serving_quantity_unit', 'quantity', 'categories_tags', 'countries_tags',
    'image_front_url', 'last_modified_t', 'url', 'images',
  ].join(',')
  for (const brand of brands) {
    if (rows.length >= limit * 4) break
    for (let page = 1; page <= 4; page += 1) {
      const url = `https://world.openfoodfacts.org/api/v2/search?brands_tags=${encodeURIComponent(brand.slug)}&countries_tags=en:france&page_size=50&page=${page}&fields=${fields}`
      let result = await client.getJson(url)
      if (!result.ok && result.reason === 'HTTP 503') result = await client.getJson(url)
      if (!result.ok) {
        report.rejected.push({ barcode: brand.slug, name: brand.name, reason: result.reason })
        break
      }
      const products = (result.body as { products?: unknown[] }).products
      if (!Array.isArray(products) || products.length === 0) break
      rows.push(...products)
      if (products.length < 50) break
    }
  }
  for (const rule of rules.filter((item) => item.open)) {
    if (rows.length >= limit * 4) break
    for (let page = 1; page <= 2; page += 1) {
      const url = `https://world.openfoodfacts.org/api/v2/search?categories_tags=${encodeURIComponent(rule.tag)}&countries_tags=en:france&page_size=50&page=${page}&fields=${fields}`
      const result = await client.getJson(url)
      if (!result.ok) {
        report.rejected.push({ barcode: rule.tag, name: rule.type, reason: result.reason })
        break
      }
      const products = (result.body as { products?: unknown[] }).products
      if (!Array.isArray(products) || products.length === 0) break
      rows.push(...products)
      if (products.length < 50) break
    }
  }
  stored.save()
  return rows
}

async function storeImage(draft: CatalogDraft, report: ImportReport): Promise<string | null> {
  const base = process.env.SUPABASE_URL
  const key = process.env.SERVICE_ROLE_KEY
  if (!draft.imageUrl || !base || !key || process.env.DRY_RUN === '1') return null
  const client = createOffClient({ minIntervalMs: 0 })
  const downloaded = await client.getBytes(draft.imageUrl)
  if (!downloaded.ok) {
    report.imageWarnings.push({ barcode: draft.barcode, reason: downloaded.reason })
    return null
  }
  try {
    const sizes = await toWebpSizes(Buffer.from(downloaded.bytes))
    await upload(`${base}/storage/v1/object/product-images/catalog/${draft.barcode}.webp`, sizes.detail, key)
    await upload(`${base}/storage/v1/object/product-images/catalog/${draft.barcode}-thumb.webp`, sizes.thumb, key)
    return `catalog/${draft.barcode}.webp`
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'image inutilisable'
    report.imageWarnings.push({ barcode: draft.barcode, reason })
    return null
  }
}

async function upload(url: string, body: Buffer, serviceKey: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
      'User-Agent': OFF_USER_AGENT,
    },
    body,
  })
  if (!response.ok) throw new Error(`stockage HTTP ${response.status}`)
}

async function upsert(payload: ReturnType<typeof draftToPayload>) {
  const base = process.env.SUPABASE_URL
  const key = process.env.SERVICE_ROLE_KEY
  if (!base || !key) throw new Error('SUPABASE_URL et SERVICE_ROLE_KEY sont requis')
  const response = await fetch(`${base}/rest/v1/rpc/upsert_catalog_product`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payload }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`)
  return text.trim().replace(/"/g, '') as 'inserted' | 'updated' | 'skipped_verified'
}

async function main() {
  loadEnv(resolve(root, '.env'))
  const limit = Number(argument('--limit') ?? process.env.LIMIT ?? 400)
  const dumpPath = argument('--dump') ?? process.env.OFF_DUMP
  const rules = parseCategoryRules(readFileSync(resolve(here, 'categories.txt'), 'utf8'))
  const brands = parseBrandList(readFileSync(resolve(here, 'brands.txt'), 'utf8'))
  const report = emptyReport()
  let rows: unknown[] = []
  if (dumpPath) {
    const dump = readDump(readFileSync(resolve(dumpPath), 'utf8'))
    rows = dump.rows
    report.brokenLines = dump.brokenLines
  } else {
    rows = await rowsFromApi(brands, rules, Number.isFinite(limit) ? limit : 400, report)
  }
  const built = buildDrafts(rows, rules, brands, Number.isFinite(limit) ? limit : 400)
  report.rejected.push(...built.rejected)
  for (const draft of built.drafts) {
    try {
      const imagePath = await storeImage(draft, report)
      if (process.env.DRY_RUN === '1') {
        recordUpsert(report, 'insert')
        continue
      }
      const status = await upsert(draftToPayload(draft, imagePath))
      if (status === 'inserted' || status === 'updated' || status === 'skipped_verified') recordUpsert(report, status)
      else report.rejected.push({ barcode: draft.barcode, name: draft.name, reason: status || 'réponse inattendue' })
    } catch (cause) {
      report.rejected.push({
        barcode: draft.barcode,
        name: draft.name,
        reason: cause instanceof Error ? cause.message : 'échec d’enregistrement',
      })
    }
  }
  console.log(formatReport(report))
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause)
  process.exit(1)
})
