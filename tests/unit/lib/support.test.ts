import { describe, expect, it } from 'vitest'
import { formatDate, formatDuration, formatGrams, formatMg, formatMl, formatNumber, minutesToParts, partsToMinutes } from '@/lib/format'
import { toUserMessage } from '@/lib/errors'
import { asNullableNumber, asNumber } from '@/lib/numbers'
import { isKnownFlavor } from '@/lib/flavors'
import { assertRuntimeConfig, getRuntimeConfig } from '@/lib/config'
import { mapProduct, mapProfile, profileToUpdate } from '@/lib/mappers'
import { mergeBox, toPlannerProducts } from '@/lib/box'
import { applyAdjustment } from '@/lib/apply-adjustment'
import { sportLabels } from '@/lib/labels'
import { emptyOuting } from '@/composables/useOuting'
import type { Adjustment } from '@/engine'
import type { Product } from '@/lib/mappers'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Gel',
  brand: null,
  type: 'gel',
  flavor: 'citron',
  carbsG: 22,
  sodiumMg: 40,
  caffeineMg: 0,
  volumeMl: null,
  scope: 'catalog',
  ownerId: null,
  ...overrides,
})

describe('formatage', () => {
  it('convertit les durées et les unités', () => {
    expect(minutesToParts(0)).toEqual({ hours: 0, minutes: 0 })
    expect(minutesToParts(Number.NaN)).toEqual({ hours: 0, minutes: 0 })
    expect(minutesToParts(125)).toEqual({ hours: 2, minutes: 5 })
    expect(partsToMinutes(2, 5)).toBe(125)
    expect(partsToMinutes(Number.NaN, -3)).toBe(0)
    expect(formatDuration(12)).toBe('12 min')
    expect(formatDuration(125)).toBe('2 h 05')
    expect(formatGrams(22)).toBe('22 g')
    expect(formatGrams(22.26)).toBe('22.3 g')
    expect(formatGrams(Number.NaN)).toBe('— g')
    expect(formatMl(499.6)).toBe('500 ml')
    expect(formatMl(Number.POSITIVE_INFINITY)).toBe('— ml')
    expect(formatMg(12.2)).toBe('12 mg')
    expect(formatMg(Number.NaN)).toBe('— mg')
    expect(formatNumber(12.4, 1)).toContain('12')
    expect(formatNumber(Number.NaN)).toBe('—')
    expect(formatDate('pas une date')).toBe('date inconnue')
    expect(formatDate('2026-05-01T10:00:00.000Z')).toContain('2026')
  })
})

describe('messages d’erreur', () => {
  it('traduit les échecs courants', () => {
    expect(toUserMessage(null)).toContain('inattendue')
    expect(toUserMessage('')).toContain('inattendue')
    expect(toUserMessage('Failed to fetch')).toContain('injoignable')
    expect(toUserMessage({ message: 'network down' })).toContain('injoignable')
    expect(toUserMessage({ message: 'JWT expired', code: 'PGRST301', status: 401 })).toContain('expiré')
    expect(toUserMessage({ message: 'Invalid Refresh Token' })).toContain('expiré')
    expect(toUserMessage({ code: '23505', message: 'duplicate' })).toContain('existe déjà')
    expect(toUserMessage({ message: 'User already registered' })).toContain('existe déjà')
    expect(toUserMessage({ code: '42501', message: 'permission denied' })).toContain('droit')
    expect(toUserMessage({ status: 403, message: 'row-level security' })).toContain('droit')
    expect(toUserMessage({ message: 'Invalid login credentials' })).toContain('incorrect')
    expect(toUserMessage({ message: 'Email not confirmed' })).toContain('Confirmez')
    expect(toUserMessage({ message: 'Error sending confirmation email' })).toContain('e-mail')
    expect(toUserMessage(new Error('Password should be at least 6 characters'))).toContain('mot de passe')
    expect(toUserMessage(new Error('Produit introuvable.'))).toBe('Produit introuvable.')
    expect(toUserMessage(12)).toContain('inattendue')
  })
})

describe('nombres et saveurs', () => {
  it('convertit les numériques Postgres', () => {
    expect(asNumber('12.5')).toBe(12.5)
    expect(asNumber(null)).toBe(0)
    expect(asNumber('')).toBe(0)
    expect(asNumber('x')).toBe(0)
    expect(asNullableNumber('')).toBeNull()
    expect(asNullableNumber('8')).toBe(8)
    expect(asNullableNumber('x')).toBeNull()
    expect(isKnownFlavor('citron')).toBe(true)
    expect(isKnownFlavor('menthe')).toBe(false)
    expect(sportLabels.trail).toContain('Trail')
  })
})

describe('configuration runtime', () => {
  it('lit la config navigateur puis refuse une config vide', () => {
    window.__RAVITOBOX_CONFIG__ = { supabaseUrl: 'http://localhost:8000', supabaseAnonKey: 'anon' }
    expect(getRuntimeConfig()).toEqual({ supabaseUrl: 'http://localhost:8000', supabaseAnonKey: 'anon' })
    expect(assertRuntimeConfig().supabaseUrl).toContain('8000')
    window.__RAVITOBOX_CONFIG__ = { supabaseUrl: '', supabaseAnonKey: '' }
    expect(() => assertRuntimeConfig()).toThrow(/manquante/)
    window.__RAVITOBOX_CONFIG__ = undefined
  })
})

describe('mappers et box', () => {
  it('mappe un profil et un produit', () => {
    const profile = mapProfile({
      id: 'u1',
      pseudo: 'Ada',
      weight_kg: '61.5' as unknown as number,
      primary_sport: 'course',
      tolerance_g_per_h: '60' as unknown as number,
      preferred_flavors: null as unknown as string[],
      role: 'user',
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    })
    expect(profile.preferredFlavors).toEqual([])
    expect(profile.weightKg).toBe(61.5)
    expect(profileToUpdate(profile).pseudo).toBe('Ada')
    const mapped = mapProduct({
      id: 'p1',
      name: 'Gel',
      brand: null,
      product_type: 'gel',
      flavor: 'citron',
      carbs_g: '22' as unknown as number,
      sodium_mg: 40,
      caffeine_mg: 0,
      volume_ml: null,
      scope: 'catalog',
      owner_id: null,
    })
    expect(mapped.carbsG).toBe(22)
    expect(mapped.sodiumKnown).toBe(true)
    expect(mapped.source).toBe('manual')
    const full = mapProduct({
      id: 'p2',
      name: 'Barre',
      brand: 'Baouw',
      product_type: 'barre',
      flavor: null,
      carbs_g: null,
      sodium_mg: null,
      caffeine_mg: null,
      volume_ml: '90',
      scope: 'custom',
      owner_id: 'u',
      barcode: '12345678',
      serving_label: '1 barre',
      serving_size: '40',
      serving_unit: 'g',
      carbs_per_100: 50,
      sugars_g: 10,
      sugars_per_100: 20,
      energy_kj: 400,
      energy_kj_per_100: 1000,
      sodium_per_100: 10,
      caffeine_per_100: 0,
      image_path: 'users/u/p2.webp',
      image_credit: 'Ada',
      source: 'off',
      source_url: 'https://world.openfoodfacts.org/product/12345678',
      data_quality: 'complete',
      verified: true,
      buy_url: 'https://exemple.fr',
      indicative_price_eur: '2.5',
      off_last_modified: '2026-01-01',
      origin_id: 'p1',
      carbs_known: false,
    })
    expect(full.carbsKnown).toBe(false)
    expect(full.sodiumKnown).toBe(false)
    expect(full.verified).toBe(true)
    expect(full.servingUnit).toBe('g')
    expect(full.dataQuality).toBe('complete')
    const base = {
      id: 'p3', name: 'Eau', brand: null, product_type: 'eau' as const, flavor: null, carbs_g: 0,
      sodium_mg: 0, caffeine_mg: 0, volume_ml: null, scope: 'catalog' as const, owner_id: null,
    }
    expect(mapProduct({ ...base, source: 'user', serving_unit: 'ml', data_quality: 'nope', verified: false }).source).toBe('user')
    expect(mapProduct({ ...base, source: 'bizarre', serving_unit: 'kg' }).servingUnit).toBeNull()
    expect(mapProduct({ ...base, source: 'manual', carbs_known: true }).carbsKnown).toBe(true)
  })

  it('fusionne la box et prépare le moteur', () => {
    const catalog = [product(), product({ id: 'p2', name: 'Eau', type: 'eau', flavor: null, volumeMl: 500 })]
    const entries = mergeBox(catalog, [{ productId: 'p1', quantity: 2, excluded: false }, { productId: 'absent', quantity: 1, excluded: false }], ['p1'])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.favorite).toBe(true)
    const outside = toPlannerProducts(entries, catalog, ['Citron'], true)
    expect(outside.some((item) => item.id === 'p2' && item.inBox === false)).toBe(true)
    const plain = product({ id: 'p3', name: 'Neutre', flavor: null, volumeMl: null })
    const withPlain = toPlannerProducts(
      mergeBox([plain], [{ productId: 'p3', quantity: 1, excluded: false }], []),
      [plain, product({ id: 'p4', name: 'Hors', flavor: null, volumeMl: null })],
      [],
      true,
    )
    expect(withPlain.every((item) => item.preferredFlavor === false)).toBe(true)
    const flagged = product({ carbsKnown: false, sodiumKnown: false, caffeineKnown: false, imagePath: 'a.webp', verified: false })
    const planned = toPlannerProducts(mergeBox([flagged], [{ productId: 'p1', quantity: 1, excluded: false }], []), [flagged], [], false)
    expect(planned[0]?.carbsKnown).toBe(false)
    expect(planned[0]?.imagePath).toBe('a.webp')
    const inside = toPlannerProducts(entries, catalog, [], false)
    expect(inside.every((item) => item.inBox)).toBe(true)
  })
})

describe('application d’un ajustement', () => {
  const form = emptyOuting()
  const note: Adjustment = { id: 'keep', field: 'note', label: 'ok', detail: '', current: null, proposed: null, requiresConfirmation: false }

  it('n’applique rien sans chiffre ou sans confirmation', () => {
    expect(applyAdjustment(form, note, false).applied).toBe(false)
    const carbs: Adjustment = { ...note, id: 'up', field: 'carbs', proposed: 90, requiresConfirmation: true }
    expect(applyAdjustment(form, carbs, false).applied).toBe(false)
    expect(applyAdjustment(form, carbs, true).form.carbOverrideGPerHour).toBe(90)
  })

  it('prépare l’eau et le sodium', () => {
    const fluid: Adjustment = { ...note, field: 'fluid', proposed: 700, requiresConfirmation: false }
    const sodium: Adjustment = { ...note, field: 'sodium', proposed: 600, requiresConfirmation: false }
    expect(applyAdjustment(form, fluid, false).form.fluidOverrideMlPerHour).toBe(700)
    expect(applyAdjustment(form, sodium, false).form.sodiumOverrideMgPerHour).toBe(600)
  })
})
