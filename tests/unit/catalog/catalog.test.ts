import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  brandMatches,
  buildDrafts,
  displayBrand,
  inferSingleServeGel,
  typeFromName,
  decideUpsert,
  dedupeRaw,
  foldText,
  matchCategory,
  offNumber,
  parseBrandList,
  parseCategoryRules,
  parsePortion,
  prepareOffProduct,
  readDump,
  slugifyBrand,
  soldInFrance,
  type BrandRule,
  type CategoryRule,
} from '@/lib/catalog/convert'
import { validateImageFile } from '@/lib/catalog/file'
import { imageAlt, publicImageUrl, variantPath } from '@/lib/catalog/images'
import { createOffClient } from '@/lib/catalog/off'
import { draftToPayload } from '@/lib/catalog/payload'
import { canAccessProductImage } from '@/lib/catalog/policy'
import { emptyReport, formatReport, recordUpsert } from '@/lib/catalog/report'
import { diceCoefficient, loose, normalizeQuery, parseSearchPayload, searchCatalog, textMatches, toSearchRpc, type CatalogItem, typeSearchLabel } from '@/lib/catalog/search'
import { groupShopping, shoppingText } from '@/lib/catalog/shopping'
import { visualsFrom } from '@/lib/catalog/visuals'
import { toWebpSizes } from '../../../scripts/import-products/resize'

const rules: CategoryRule[] = parseCategoryRules('en:energy-gels gel\n# commentaire\n\nen:inconnu nope\nen:compotes compote open\n')
const brands: BrandRule[] = [
  { slug: 'baouw', name: 'Baouw' },
  { slug: 'gu', name: 'GU' },
  { slug: 'x', name: '' },
]

function off(overrides: Record<string, unknown> = {}) {
  return {
    code: '1234567890123',
    product_name_fr: 'Gel citron',
    brands: 'Baouw',
    countries_tags: ['en:france'],
    categories_tags: ['en:energy-gels'],
    nutriments: {
      carbohydrates_100g: 50,
      carbohydrates_serving: 20,
      sugars_100g: 10,
      sodium_100g: 0.04,
      caffeine_100g: 0,
      'energy-kj_100g': 800,
    },
    serving_quantity: 40,
    serving_quantity_unit: 'g',
    image_front_url: 'https://images.openfoodfacts.org/front.jpg',
    url: 'https://world.openfoodfacts.org/product/1234567890123',
    last_modified_t: 1_700_000_000,
    ...overrides,
  }
}

describe('conversion Open Food Facts', () => {
  it('plie les accents et parse les listes du dépôt', () => {
    expect(foldText('Été à Noël')).toBe('ete a noel')
    expect(foldText('cœur')).toBe('cour')
    expect(slugifyBrand('Näak Energy!')).toBe('naak-energy')
    const fromFile = parseCategoryRules(readFileSync('scripts/import-products/categories.txt', 'utf8'))
    expect(fromFile.some((rule) => rule.tag === 'en:energy-gels' && rule.type === 'gel')).toBe(true)
    const brandFile = parseBrandList(readFileSync('scripts/import-products/brands.txt', 'utf8'))
    expect(brandFile.some((brand) => brand.slug === 'maurten')).toBe(true)
    expect(parseBrandList('# c\n\nBaouw\n| \nsis|SiS\n')).toEqual([
      { slug: 'baouw', name: 'Baouw' },
      { slug: 'sis', name: 'SiS' },
    ])
  })

  it('reconnaît la France, la catégorie et la marque', () => {
    expect(soldInFrance(undefined)).toBe(false)
    expect(soldInFrance([])).toBe(false)
    expect(soldInFrance(['en:france'])).toBe(true)
    expect(soldInFrance(['fr:france'])).toBe(true)
    expect(soldInFrance(['france'])).toBe(true)
    expect(soldInFrance(['en:germany'])).toBe(false)
    expect(matchCategory(undefined, rules)).toBeNull()
    expect(matchCategory([], rules)).toBeNull()
    expect(matchCategory(['en:other'], rules)).toBeNull()
    expect(matchCategory(['en:energy-gels'], rules)?.type).toBe('gel')
    expect(brandMatches(null, brands)).toBe(false)
    expect(brandMatches('Baouw', [])).toBe(false)
    expect(brandMatches('Baouw', brands)).toBe(true)
    expect(brandMatches('GU', brands)).toBe(true)
    expect(brandMatches('Gum', brands)).toBe(false)
    expect(brandMatches('Autre', brands)).toBe(false)
    expect(brandMatches('X', [{ slug: 'x', name: '' }])).toBe(false)
    const opened = prepareOffProduct(off({ brands: 'Marque libre', categories_tags: ['en:compotes'] }), rules, brands)
    expect(opened.ok).toBe(true)
    expect(typeFromName('scoop boisson')).toBe('boisson')
    expect(typeFromName('barre céréales')).toBe('barre')
    expect(typeFromName('chew original')).toBe('autre')
    expect(typeFromName('compote pomme')).toBe('compote')
    expect(typeFromName('pâte de fruits')).toBe('pate_de_fruit')
    expect(typeFromName('gel energix')).toBe('gel')
    expect(typeFromName('Iso+ fraise')).toBe('boisson')
    expect(textMatches('Iso+ orange', 'Decathlon', 'iso decathlon')).toBe(true)
    expect(typeFromName('capsule de sel')).toBe('capsule_sel')
    expect(typeFromName('beta fuel')).toBeNull()
    expect(inferSingleServeGel('beta fuel', { size: 31, unit: 'g' }, 30)).toBe(true)
    expect(inferSingleServeGel('gel citron', { size: 40, unit: 'g' }, 20)).toBe(false)
    expect(inferSingleServeGel('beta fuel', null, 30)).toBe(false)
    expect(inferSingleServeGel('beta fuel', { size: 31, unit: 'ml' }, 30)).toBe(false)
    expect(inferSingleServeGel('beta fuel', { size: 10, unit: 'g' }, 30)).toBe(false)
    expect(inferSingleServeGel('beta fuel', { size: 90, unit: 'g' }, 30)).toBe(false)
    expect(inferSingleServeGel('beta fuel', { size: 31, unit: 'g' }, 10)).toBe(false)
    expect(displayBrand('Precision Fuel', [{ slug: 'precision-fuel', name: 'Precision Fuel & Hydration' }])).toBe('Precision Fuel & Hydration')
    expect(displayBrand('Overstims', [{ slug: 'overstims', name: 'Overstims' }])).toBe('Overstims')
    expect(displayBrand('   ', [])).toBe('')
    const other = prepareOffProduct({
      code: '3700153150405',
      product_name: 'Muffins sport',
      brands: 'Overstims',
      countries_tags: ['en:france'],
      categories_tags: ['fr:produits pour sportifs'],
      serving_size: '100 g',
      nutriments: { carbohydrates_serving: 40, sodium_100g: 0, caffeine_100g: 0 },
    }, [{ tag: 'fr:produits pour sportifs', type: 'autre', open: true }], [{ slug: 'overstims', name: 'Overstims' }])
    expect(other.ok).toBe(true)
    if (other.ok) expect(other.draft.productType).toBe('autre')
    const iso = prepareOffProduct({
      code: '3583787674246',
      product_name: 'Iso+ orange',
      brands: 'Decathlon',
      countries_tags: ['en:france'],
      categories_tags: ['fr:produits pour sportifs'],
      serving_size: '13 g',
      nutriments: { carbohydrates_100g: 11, carbohydrates_serving: 1.4, sodium_100g: 0.05, caffeine_100g: 0 },
    }, [{ tag: 'fr:produits pour sportifs', type: 'autre', open: true }], [{ slug: 'decathlon', name: 'Decathlon' }])
    expect(iso.ok).toBe(true)
    if (iso.ok) expect(iso.draft.productType).toBe('boisson')
    const plain = prepareOffProduct({
      code: '1111111111116',
      product_name: 'Muffins sport',
      brands: 'Overstims',
      countries_tags: ['en:france'],
      serving_size: '100 g',
      nutriments: { carbohydrates_serving: 40, sodium_100g: 0, caffeine_100g: 0 },
    }, rules, [{ slug: 'overstims', name: 'Overstims' }])
    expect(plain.ok).toBe(true)
    if (plain.ok) expect(plain.draft.productType).toBe('autre')
    const uncategorized = prepareOffProduct({
      code: '3700153131619',
      product_name: 'Energix Liquide citron 35 g',
      brands: 'Overstims',
      countries_tags: ['en:france'],
      nutriments: { carbohydrates_100g: 49, sodium_100g: 0.04, caffeine_100g: 0 },
    }, rules, [{ slug: 'overstims', name: 'Overstims' }])
    expect(uncategorized.ok).toBe(true)
    if (uncategorized.ok) expect(uncategorized.draft.productType).toBe('gel')
    const precision = prepareOffProduct({
      code: '5060905441037',
      product_name: 'Precision Fuel 30',
      brands: 'Precision Fuel',
      countries_tags: ['en:france'],
      serving_size: '31 g',
      nutriments: { carbohydrates_serving: 30, sodium_100g: 0.1, caffeine_100g: 0 },
    }, rules, [{ slug: 'precision-fuel', name: 'Precision Fuel & Hydration' }])
    expect(precision.ok).toBe(true)
    if (precision.ok) {
      expect(precision.draft.productType).toBe('gel')
      expect(precision.draft.brand).toContain('Hydration')
    }
  })

  it('convertit une portion et un nombre', () => {
    expect(offNumber(12)).toBe(12)
    expect(offNumber(Number.NaN)).toBeNull()
    expect(offNumber('1,5')).toBe(1.5)
    expect(offNumber('nope')).toBeNull()
    expect(offNumber('')).toBeNull()
    expect(offNumber(null)).toBeNull()
    expect(parsePortion('')).toBeNull()
    expect(parsePortion('sans unité')).toBeNull()
    expect(parsePortion('1 gel (32 g)')).toEqual({ size: 32, unit: 'g' })
    expect(parsePortion('0,5 kg')).toEqual({ size: 500, unit: 'g' })
    expect(parsePortion('0,5 l')).toEqual({ size: 500, unit: 'ml' })
    expect(parsePortion('25 cl')).toEqual({ size: 250, unit: 'ml' })
    expect(parsePortion('500 ml')).toEqual({ size: 500, unit: 'ml' })
    expect(parsePortion('0 g')).toBeNull()
    expect(parsePortion('6000 g')).toBeNull()
  })

  it('mappe une fiche complète, le sel, la caféine et les trous', () => {
    const mapped = prepareOffProduct(off(), rules, brands)
    expect(mapped.ok).toBe(true)
    if (mapped.ok) {
      expect(mapped.draft.carbsG).toBe(20)
      expect(mapped.draft.sodiumMg).toBe(16)
      expect(mapped.draft.caffeineMg).toBe(0)
      expect(mapped.draft.dataQuality).toBe('complete')
      expect(mapped.draft.servingLabel).toBe('1 gel de 40 g')
      expect(mapped.draft.flavor).toBeNull()
      expect(draftToPayload(mapped.draft, 'catalog/x.webp').image_credit).toContain('Open Food Facts')
      expect(draftToPayload(mapped.draft, null).image_credit).toBeNull()
    }
    const salt = prepareOffProduct(off({
      nutriments: { carbohydrates_100g: 40, salt_100g: 1, caffeine_100g: 0.032, caffeine_unit: 'g', 'energy-kcal_100g': 200 },
      serving_quantity: undefined,
      serving_size: '50 g',
    }), rules, brands)
    expect(salt.ok).toBe(true)
    if (salt.ok) expect(salt.draft.sodiumPer100).toBe(400)

    const milligrams = prepareOffProduct(off({
      nutriments: { carbohydrates_serving: 22, sodium_serving: 0.05, caffeine_100g: 75, caffeine_unit: 'mg', energy_100g: 900 },
      serving_quantity: undefined,
      quantity: '40 g',
    }), rules, brands)
    expect(milligrams.ok).toBe(true)

    const bare = prepareOffProduct(off({
      nutriments: { carbohydrates_serving: 18 },
      serving_quantity: undefined,
      serving_size: undefined,
      quantity: undefined,
      image_front_url: 'pas-une-url',
      images: { front_fr: { uploader: 'Ada' } },
    }), rules, brands)
    expect(bare.ok).toBe(true)
    if (bare.ok) {
      expect(bare.draft.sodiumMg).toBeNull()
      expect(bare.draft.caffeineMg).toBeNull()
      expect(bare.draft.dataQuality).toBe('incomplete')
      expect(bare.draft.imageUrl).toBeNull()
    }
  })

  it('rejette les fiches inutilisables et n’invente rien', () => {
    expect(prepareOffProduct(null, rules, brands).ok).toBe(false)
    expect(prepareOffProduct({ code: '12' }, rules, brands)).toMatchObject({ reason: 'code-barres invalide' })
    expect(prepareOffProduct({ code: '12345678' }, rules, brands)).toMatchObject({ reason: 'nom absent' })
    expect(prepareOffProduct(off({ countries_tags: ['en:belgium'] }), rules, brands)).toMatchObject({ reason: 'hors France' })
    expect(prepareOffProduct(off({ countries_tags: undefined }), rules, brands)).toMatchObject({ reason: 'hors France' })
    expect(prepareOffProduct(off({ categories_tags: ['en:yogurts'], brands: 'Marque inconnue' }), rules, brands)).toMatchObject({ reason: 'catégorie hors périmètre' })
    expect(prepareOffProduct(off({ brands: 'Marque inconnue' }), rules, brands)).toMatchObject({ reason: 'marque hors liste' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: -1 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: 120 } }), rules, brands)).toMatchObject({ reason: 'glucides aberrants' })
    expect(prepareOffProduct(off({ nutriments: { sugars_100g: -1, carbohydrates_100g: 10 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: 10, sodium_100g: -1 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: 10, salt_100g: -1 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: 10, sodium_serving: -1 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: 10, caffeine_100g: -1 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: 10, caffeine_serving: -1 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: 10, 'energy-kj_100g': -5 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({
      nutriments: { carbohydrates_100g: 50, carbohydrates_serving: 50 },
      serving_quantity: 40,
      serving_quantity_unit: 'g',
    }), rules, brands)).toMatchObject({ reason: 'glucides supérieurs à la portion' })
    expect(prepareOffProduct(off({
      nutriments: {},
      serving_quantity: 40,
      serving_quantity_unit: 'g',
    }), rules, brands)).toMatchObject({ reason: 'glucides absents' })
    expect(prepareOffProduct(off({
      nutriments: { carbohydrates_100g: 50 },
      serving_quantity: undefined,
      serving_size: undefined,
      quantity: undefined,
    }), rules, brands)).toMatchObject({ reason: 'portion inconnue' })
    const bigCaffeine = prepareOffProduct(off({
      nutriments: { carbohydrates_serving: 10, caffeine_100g: 30 },
      serving_quantity: undefined,
    }), rules, brands)
    expect(bigCaffeine.ok).toBe(true)
    const photographer = prepareOffProduct(off({
      image_front_url: 'https://images.openfoodfacts.org/a.jpg',
      photographers: ['Camille'],
      images: { front: { uploader: '' } },
    }), rules, brands)
    expect(photographer.ok).toBe(true)
    if (photographer.ok) expect(photographer.draft.imageCredit).toBe('Camille')
    const longCredit = prepareOffProduct(off({ images: { front: { uploader: 'A'.repeat(200) } } }), rules, brands)
    expect(longCredit.ok).toBe(true)
    if (longCredit.ok) expect(longCredit.draft.imageCredit?.length).toBe(120)
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: 10, carbohydrates_serving: -1 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_100g: 10, sugars_serving: -1 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: { carbohydrates_serving: 12, caffeine_serving: 0.03, sodium_serving: 80, 'energy-kcal_100g': -1 } }), rules, brands)).toMatchObject({ reason: 'valeur négative' })
    expect(prepareOffProduct(off({ nutriments: null }), rules, brands).ok).toBe(false)
    const decimal = prepareOffProduct(off({ serving_quantity: 32.5, serving_quantity_unit: 'g', last_modified_t: undefined }), rules, brands)
    expect(decimal.ok).toBe(true)
    if (decimal.ok) {
      expect(decimal.draft.servingLabel).toContain('32.5')
      expect(decimal.draft.offLastModified).toBeNull()
    }
    const withServing = prepareOffProduct(off({
      nutriments: { carbohydrates_serving: 18, sodium_serving: 80, caffeine_serving: 30 },
      url: '',
    }), rules, brands)
    expect(withServing.ok).toBe(true)
    if (withServing.ok) expect(withServing.draft.sourceUrl).toContain('1234567890123')
    const drink = prepareOffProduct(off({
      categories_tags: ['en:compotes'],
      serving_quantity: 90,
      serving_quantity_unit: 'ml',
      product_name_fr: 'G',
    }), rules, brands)
    expect(drink.ok).toBe(true)
    if (drink.ok) expect(drink.draft.volumeMl).toBe(90)
  })

  it('dédoublonne, limite et n’écrase pas un produit vérifié', () => {
    const older = off({ last_modified_t: 10 })
    const newer = off({ last_modified_t: 20, product_name_fr: 'Gel nouveau' })
    const same = off({ last_modified_t: 20, product_name_fr: 'Gel dernier' })
    const rows = dedupeRaw([older, { code: 'abc' }, newer, same, null, off({ last_modified_t: undefined, product_name_fr: 'Sans date' })])
    expect(rows.length).toBeGreaterThan(1)
    const built = buildDrafts([newer, older, { nope: true }], rules, brands, 1)
    expect(built.drafts).toHaveLength(1)
    expect(built.drafts[0]?.name).toBe('Gel nouveau')
    expect(buildDrafts([newer], rules, brands, 0).drafts).toEqual([])
    expect(buildDrafts([newer], rules, brands, Number.NaN).drafts).toEqual([])
    const dump = readDump('\n{"code":"1"}\npas du json\n')
    expect(dump.rows).toHaveLength(1)
    expect(dump.brokenLines).toBe(1)
    expect(decideUpsert(null)).toBe('insert')
    expect(decideUpsert({ verified: false })).toBe('update')
    expect(decideUpsert({ verified: true })).toBe('skip_verified')
  })
})

describe('recherche', () => {
  const items: CatalogItem[] = [
    { id: 'b', name: 'Barre citron', brand: 'Baouw', type: 'barre', flavor: 'citron', carbsG: 30, sodiumMg: 10, caffeineMg: null, verified: true, inBox: false },
    { id: 'a', name: 'Gel cola', brand: 'Overstims', type: 'gel', flavor: 'cola', carbsG: 22, sodiumMg: null, caffeineMg: 75, verified: false, inBox: true },
    { id: 'c', name: 'Eau', brand: null, type: 'eau', flavor: null, carbsG: null, sodiumMg: 0, caffeineMg: 0, verified: false, inBox: false },
  ]

  it('tolère les fautes, filtre et pagine', () => {
    expect(diceCoefficient('', 'gel')).toBe(0)
    expect(diceCoefficient('gel', 'gel')).toBe(1)
    expect(diceCoefficient('a', 'b')).toBe(0)
    expect(diceCoefficient('aaaa', 'bbbb')).toBe(0)
    expect(diceCoefficient('gel', 'gels')).toBeGreaterThan(0)
    expect(diceCoefficient('ab', 'abab')).toBeGreaterThan(0)
    expect(textMatches('Gel', 'Baouw', '')).toBe(true)
    expect(textMatches('Gel citron', null, 'citron')).toBe(true)
    expect(textMatches('Gel', null, 'zz')).toBe(false)
    expect(textMatches('Gel citronné', null, 'citronne')).toBe(true)
    expect(textMatches('Pâte de fruits', null, 'patte de fruits')).toBe(true)
    expect(textMatches('Energix liquide gel', 'Overstims', 'gel overstims')).toBe(true)
    expect(typeSearchLabel('pate_de_fruit')).toBe('pate de fruits')
    expect(typeSearchLabel('capsule_sel')).toBe('capsule sel')
    expect(typeSearchLabel('autre')).toBe('')
    expect(typeSearchLabel('gel')).toBe('gel')
    expect(loose('patte')).toBe('pate')
    const combined = searchCatalog(items, {
      text: 'citron', type: 'barre', brand: 'Baouw', flavor: 'citron', carbsMin: 20, carbsMax: 40,
      hasSodium: true, hasCaffeine: false, verifiedOnly: true, inBoxOnly: false, sort: 'carbs', page: 1, pageSize: 24,
    })
    expect(combined.items.map((item) => item.id)).toEqual(['b'])
    expect(searchCatalog(items, { type: 'inconnu', sort: 'bizarre', page: 0, pageSize: 0 }).pageSize).toBe(1)
    expect(searchCatalog(items, { page: 9, pageSize: 100, sort: 'brand' }).items).toEqual([])
    expect(searchCatalog(items, { sort: 'name', page: 1, pageSize: 24 }).items[0]?.id).toBe('b')
    expect(searchCatalog(items, { hasCaffeine: true }).items.map((item) => item.id)).toEqual(['c', 'a'])
    expect(searchCatalog(items, { inBoxOnly: true }).total).toBe(1)
    expect(searchCatalog(items, { sort: 'carbs' }).items.at(-1)?.id).toBe('c')
    expect(searchCatalog(items, { flavor: 'menthe', brand: 'ZZZ', text: 'zzzzz', carbsMax: 1, verifiedOnly: true }).total).toBe(0)
    const twins: CatalogItem[] = [
      { id: 'b', name: 'Même', brand: 'Baouw', type: 'gel', flavor: null, carbsG: 22, sodiumMg: 1, caffeineMg: 1, verified: true, inBox: true },
      { id: 'a', name: 'Même', brand: 'Baouw', type: 'gel', flavor: null, carbsG: 22, sodiumMg: 1, caffeineMg: 1, verified: true, inBox: true },
    ]
    expect(searchCatalog(twins, { sort: 'brand' }).items.map((item) => item.id)).toEqual(['a', 'b'])
    expect(searchCatalog(twins, { sort: 'carbs' }).items[0]?.id).toBe('a')
    const odd: CatalogItem[] = [
      { id: 'z', name: 'A', brand: null, type: 'eau', flavor: null, carbsG: null, sodiumMg: null, caffeineMg: null, verified: false, inBox: false },
      { id: 'y', name: 'A', brand: null, type: 'eau', flavor: null, carbsG: null, sodiumMg: 1, caffeineMg: null, verified: true, inBox: true },
    ]
    expect(searchCatalog(odd, { sort: 'carbs' }).total).toBe(2)
    expect(searchCatalog(odd, { sort: 'brand' }).total).toBe(2)
    expect(searchCatalog(items, { hasSodium: true, verifiedOnly: true }).total).toBe(1)
    expect(searchCatalog([
      { id: 'g', name: 'Energix', brand: 'Overstims', type: 'gel', flavor: null, carbsG: 17, sodiumMg: null, caffeineMg: null, verified: false, inBox: false },
    ], { text: 'gel overstims' }).total).toBe(1)
    expect(searchCatalog(items, { flavor: 'menthe' }).total).toBe(0)
    expect(searchCatalog(items, { text: 'zzzzz' }).total).toBe(0)
    expect(searchCatalog(items, { carbsMin: 25, carbsMax: 25 }).total).toBe(0)
    expect(searchCatalog(items, { brand: 'Baouw' }).items.every((item) => item.brand === 'Baouw')).toBe(true)
    expect(searchCatalog(items, { carbsMin: 100 }).total).toBe(0)
    expect(normalizeQuery({ page: Number.NaN, pageSize: Number.NaN, carbsMin: Number.NaN }).page).toBe(1)
    expect(toSearchRpc({ text: 'gel', page: 2, pageSize: 10 }, 'all', true).p_offset).toBe(10)
    expect(parseSearchPayload(null)).toEqual({ total: 0, items: [] })
    expect(parseSearchPayload([])).toEqual({ total: 0, items: [] })
    expect(parseSearchPayload({ total: -1, items: 'nope' })).toEqual({ total: 0, items: [] })
    expect(parseSearchPayload({ total: 2.8, items: [{ id: 'a' }, null, []] }).total).toBe(2)
  })
})

describe('images, fichiers et politiques', () => {
  it('fabrique une URL locale et refuse un lien externe', () => {
    expect(publicImageUrl(null)).toBeNull()
    expect(publicImageUrl('https://images.openfoodfacts.org/x.jpg')).toBeNull()
    expect(publicImageUrl('http://example.test/a.webp')).toBeNull()
    expect(publicImageUrl('catalog/a.webp')).toBe('/storage/v1/object/public/product-images/catalog/a.webp')
    expect(publicImageUrl('/catalog/a.webp')).toContain('catalog/a.webp')
    expect(publicImageUrl('../secret.webp')).toBeNull()
    expect(publicImageUrl('/')).toBeNull()
    expect(variantPath('catalog/a.webp', 'detail')).toBe('catalog/a.webp')
    expect(variantPath('catalog/a.webp', 'thumb')).toBe('catalog/a-thumb.webp')
    expect(variantPath('catalog/a-thumb.webp', 'thumb')).toBe('catalog/a-thumb.webp')
    expect(variantPath('catalog/a.png', 'thumb')).toBe('catalog/a.png-thumb.webp')
    expect(imageAlt('  ')).toBe('Produit')
    expect(imageAlt('Gel')).toBe('Gel')
    expect(visualsFrom([{ id: '1', name: 'Gel', type: 'gel', imagePath: 'a.webp' }])['1']?.imagePath).toBe('a.webp')
    expect(visualsFrom([{ id: '2', name: 'Eau', type: 'eau' }])['2']?.imagePath).toBeNull()
  })

  it('valide le type réel et la taille', () => {
    expect(validateImageFile(new Uint8Array())).toEqual({ ok: false, reason: 'fichier vide' })
    expect(validateImageFile(new Uint8Array([1]), 0).ok).toBe(false)
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00])
    const asJpeg = validateImageFile(jpeg)
    expect(asJpeg.ok && asJpeg.mime).toBe('image/jpeg')
    expect(validateImageFile(jpeg, 3 * 1024 * 1024).ok).toBe(false)
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])
    const asPng = validateImageFile(png)
    expect(asPng.ok && asPng.mime).toBe('image/png')
    const webp = new Uint8Array(12)
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    const asWebp = validateImageFile(webp)
    expect(asWebp.ok && asWebp.mime).toBe('image/webp')
    expect(validateImageFile(new Uint8Array([0x52, 0x49])).ok).toBe(false)
    const huge = new Uint8Array(2 * 1024 * 1024 + 1)
    huge[0] = 0xff
    expect(validateImageFile(huge).ok).toBe(false)
  })

  it('n’autorise l’écriture catalogue qu’à un admin, et le dossier perso qu’à son propriétaire', () => {
    expect(canAccessProductImage({ actor: 'anon', userId: null, path: 'catalog/a.webp', action: 'read' })).toBe(true)
    expect(canAccessProductImage({ actor: 'anon', userId: null, path: 'a.webp', action: 'read' })).toBe(false)
    expect(canAccessProductImage({ actor: 'user', userId: 'u1', path: 'users/../a.webp', action: 'write' })).toBe(false)
    expect(canAccessProductImage({ actor: 'admin', userId: 'u1', path: 'catalog/a.webp', action: 'write' })).toBe(true)
    expect(canAccessProductImage({ actor: 'user', userId: 'u1', path: 'catalog/a.webp', action: 'delete' })).toBe(false)
    expect(canAccessProductImage({ actor: 'admin', userId: 'u1', path: 'catalog', action: 'write' })).toBe(false)
    expect(canAccessProductImage({ actor: 'user', userId: 'u1', path: 'users/u1/a.webp', action: 'write' })).toBe(true)
    expect(canAccessProductImage({ actor: 'user', userId: 'u1', path: 'users/u2/a.webp', action: 'delete' })).toBe(false)
    expect(canAccessProductImage({ actor: 'anon', userId: null, path: 'users/u1/a.webp', action: 'write' })).toBe(false)
    expect(canAccessProductImage({ actor: 'user', userId: null, path: 'users/u1/a.webp', action: 'write' })).toBe(false)
    expect(canAccessProductImage({ actor: 'user', userId: 'u1', path: 'users/u1', action: 'write' })).toBe(false)
    expect(canAccessProductImage({ actor: 'user', userId: 'u1', path: 'autre/a.webp', action: 'write' })).toBe(false)
    const sql = readFileSync('supabase/storage.sql', 'utf8')
    expect(sql).toContain('product_images_read')
    expect(sql).toContain('product_images_admin_catalog')
    expect(sql).toContain("bucket_id = 'product-images'")
    expect(sql).toMatch(/is_admin/)
  })

  it('convertit en WebP et refuse une image corrompue', async () => {
    const sharp = (await import('sharp')).default
    const png = await sharp({ create: { width: 32, height: 8, channels: 3, background: { r: 20, g: 90, b: 40 } } }).png().toBuffer()
    const sizes = await toWebpSizes(png)
    const thumb = await sharp(sizes.thumb).metadata()
    const detail = await sharp(sizes.detail).metadata()
    expect(thumb.format).toBe('webp')
    expect(detail.format).toBe('webp')
    expect(thumb.width).toBeLessThanOrEqual(160)
    expect(detail.width).toBeLessThanOrEqual(640)
    await expect(toWebpSizes(Buffer.from('pas une image'))).rejects.toThrow()
  })
})

describe('liste de courses et rapport', () => {
  it('groupe par marque et décrit le rapport', () => {
    const lines = [
      { productId: '1', name: 'Gel', toBring: 2, missing: 1, inBox: true, brand: 'Baouw' },
      { productId: '2', name: 'Barre', toBring: 1, missing: 0, inBox: true, brand: '  ' },
      { productId: '3', name: 'Eau', toBring: 0, missing: 2, inBox: false },
    ]
    expect(groupShopping(lines).map((group) => group.brand)).toEqual(['Baouw', 'Sans marque'])
    expect(shoppingText(lines)).toContain('Baouw')
    expect(shoppingText([])).toContain('Rien à acheter')
    const report = emptyReport()
    recordUpsert(report, 'inserted')
    recordUpsert(report, 'updated')
    recordUpsert(report, 'skipped_verified')
    report.rejected.push({ barcode: '1', name: 'A', reason: 'portion inconnue' })
    report.imageWarnings.push({ barcode: '1', reason: 'image vide' })
    expect(formatReport(report)).toContain('Ajoutés : 1')
    expect(formatReport(report)).toContain('portion inconnue')
  })
})

describe('client Open Food Facts', () => {
  it('met en cache, respecte le débit et remonte les erreurs', async () => {
    const calls: string[] = []
    const cache = new Map<string, string>()
    let clock = 0
    const sleeps: number[] = []
    const client = createOffClient({
      cache,
      now: () => clock,
      sleep: async (ms) => { sleeps.push(ms) },
      minIntervalMs: 1000,
      fetchImpl: async (url, init) => {
        calls.push(String(url))
        expect((init?.headers as Record<string, string>)['User-Agent']).toContain('ravitoBox')
        if (String(url).endsWith('/rate')) return new Response('{"products":[]}', { status: 200 })
        if (String(url).endsWith('/bad-json')) return new Response('non', { status: 200 })
        if (String(url).endsWith('/empty')) return new Response('', { status: 200 })
        if (String(url).endsWith('/bytes')) return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
        if (String(url).endsWith('/no-bytes')) return new Response(new Uint8Array(), { status: 200 })
        return new Response('nope', { status: 429 })
      },
    })
    const first = await client.getJson('https://off.test/rate')
    expect(first.ok).toBe(true)
    clock = 0
    const cached = await client.getJson('https://off.test/rate')
    expect(cached.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(sleeps.length).toBeGreaterThan(0)
    clock = 10_000
    cache.set('https://off.test/broken', '{')
    const broken = await client.getJson('https://off.test/broken')
    expect(broken.ok).toBe(false)
    clock = 20_000
    expect((await client.getJson('https://off.test/missing')).ok).toBe(false)
    clock = 30_000
    expect((await client.getJson('https://off.test/bad-json')).ok).toBe(false)
    clock = 40_000
    expect((await client.getBytes('https://off.test/bytes')).ok).toBe(true)
    clock = 50_000
    expect((await client.getBytes('https://off.test/no-bytes')).ok).toBe(false)
    clock = 60_000
    const failing = createOffClient({
      minIntervalMs: 0,
      fetchImpl: async () => { throw new Error('') },
    })
    expect((await failing.getJson('https://off.test/x')).ok).toBe(false)
    const text = createOffClient({
      minIntervalMs: 0,
      fetchImpl: async () => { throw 'réseau' },
    })
    expect((await text.getJson('https://off.test/x')).ok).toBe(false)
    const bytesFail = createOffClient({
      minIntervalMs: 0,
      fetchImpl: async () => ({ ok: true, arrayBuffer: async () => { throw new Error('coupée') }, text: async () => '{}' }) as unknown as Response,
    })
    expect((await bytesFail.getBytes('https://off.test/x')).ok).toBe(false)
    const defaults = createOffClient({
      fetchImpl: async () => new Response('{}', { status: 200 }),
    })
    expect((await defaults.getJson('https://off.test/plain')).ok).toBe(true)
    const denied = createOffClient({
      minIntervalMs: 0,
      fetchImpl: async () => new Response('no', { status: 500 }),
    })
    expect((await denied.getBytes('https://off.test/denied')).ok).toBe(false)
  })

  it('utilise le fetch et la pause par défaut', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createOffClient({ minIntervalMs: 20 })
    expect((await client.getJson('https://off.test/default')).ok).toBe(true)
    const second = client.getJson('https://off.test/default-2')
    await vi.advanceTimersByTimeAsync(25)
    expect((await second).ok).toBe(true)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})
