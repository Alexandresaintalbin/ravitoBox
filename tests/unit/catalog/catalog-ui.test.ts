import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import Attribution from '@/components/Attribution.vue'
import CatalogFilters from '@/components/CatalogFilters.vue'
import ProductFacts from '@/components/ProductFacts.vue'
import ProductImage from '@/components/ProductImage.vue'
import ProductTile from '@/components/ProductTile.vue'
import ShoppingList from '@/components/ShoppingList.vue'
import SkeletonCards from '@/components/SkeletonCards.vue'
import Stepper from '@/components/Stepper.vue'
import TabBar from '@/components/TabBar.vue'
import Timeline from '@/components/Timeline.vue'
import CatalogView from '@/views/CatalogView.vue'
import ProductDetailView from '@/views/ProductDetailView.vue'
import AdminReviewView from '@/views/AdminReviewView.vue'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import type { Product } from '@/lib/mappers'
import type { ProductType } from '@/engine/types'
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'search_products') {
        return { data: { total: 30, items: [sampleRow] }, error: null }
      }
      if (fn === 'admin_list_forks') return { data: [forkRow], error: null }
      if (fn === 'fork_catalog_product') return { data: 'fork-1', error: null }
      return { data: null, error: null }
    }),
    from: () => {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      for (const method of ['select', 'update', 'eq', 'upsert', 'insert', 'delete', 'order']) builder[method] = vi.fn(chain)
      builder.maybeSingle = vi.fn(async () => ({ data: sampleRow, error: null }))
      builder.single = vi.fn(async () => ({ data: sampleRow, error: null }))
      builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
      return builder
    },
    storage: { from: () => ({ upload: vi.fn(async () => ({ error: null })) }) },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  }),
}))

const sampleRow = {
  id: 'p1', name: 'Gel citron', brand: 'Baouw', product_type: 'gel', flavor: 'citron',
  carbs_g: 22, sodium_mg: null, caffeine_mg: 30, volume_ml: null, scope: 'catalog', owner_id: null,
  barcode: '12345678', serving_label: '1 gel de 40 g', serving_unit: 'g', carbs_per_100: 55,
  sugars_g: null, energy_kj: 400, sodium_per_100: null, caffeine_per_100: 75, image_path: null,
  image_credit: 'Ada', source: 'off', source_url: 'https://world.openfoodfacts.org/product/12345678',
  data_quality: 'incomplete', verified: false, buy_url: 'https://exemple.fr', indicative_price_eur: 2.4,
  off_last_modified: '2026-01-01T00:00:00.000Z', carbs_known: true,
}

const forkRow = { ...sampleRow, id: 'f1', name: 'Gel (ma version)', scope: 'custom', source: 'user', origin_id: 'p1' }

function piniaRouter() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/app', name: 'dashboard', component: { template: '<div />' } },
      { path: '/app/box', name: 'box', component: { template: '<div />' } },
      { path: '/app/plans', name: 'plans', component: { template: '<div />' } },
      { path: '/app/compte', name: 'account', component: { template: '<div />' } },
      { path: '/app/sortie', component: { template: '<div />' } },
      { path: '/app/catalogue/:id', name: 'product', component: { template: '<div />' } },
      { path: '/app/produits/:id', component: { template: '<div />' } },
      { path: '/app/plans/:id', component: { template: '<div />' } },
      { path: '/app/plans/:id/debrief', component: { template: '<div />' } },
    ],
  })
  const auth = useAuthStore()
  auth.user = { id: 'user-1' } as never
  auth.profile = { id: 'user-1', pseudo: 'Ada', weightKg: null, primarySport: null, toleranceGPerHour: 60, preferredFlavors: [], role: 'admin', createdAt: '', updatedAt: '' }
  auth.ready = true
  return { pinia, router }
}

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Gel citron', brand: 'Baouw', type: 'gel', flavor: 'citron', carbsG: 22, sodiumMg: 0,
  caffeineMg: 30, volumeMl: null, scope: 'catalog', ownerId: null, verified: false, sodiumKnown: false,
  carbsKnown: true, caffeineKnown: true, dataQuality: 'incomplete', source: 'off', servingLabel: '1 gel de 40 g',
  sugarsG: null, energyKj: null, carbsPer100: null, buyUrl: 'https://exemple.fr', indicativePriceEur: 3,
  sourceUrl: 'https://world.openfoodfacts.org/product/1', imageCredit: 'Ada', offLastModified: '2026-01-01',
  ...overrides,
})

describe('interface catalogue', () => {
  it('affiche images, filtres, fiche, parcours et états', async () => {
    URL.createObjectURL = () => 'blob:test'
    URL.revokeObjectURL = () => undefined
    const { pinia, router } = piniaRouter()
    const types: ProductType[] = ['gel', 'boisson', 'barre', 'compote', 'pate_de_fruit', 'capsule_sel', 'eau', 'autre']
    for (const type of types) {
      const image = render(ProductImage, { props: { name: type, type } })
      expect(image.getByRole('img', { name: type })).toBeTruthy()
    }
    const photo = render(ProductImage, { props: { name: 'Gel', type: 'gel', imagePath: 'catalog/a.webp', variant: 'detail' } })
    const img = photo.getByRole('img', { name: 'Gel' })
    await fireEvent.error(img)
    expect(photo.getByRole('img', { name: 'Gel' })).toBeTruthy()
    expect(render(Attribution).getByRole('link', { name: 'licence ODbL' })).toBeTruthy()
    expect(render(SkeletonCards).getByRole('status').textContent).toContain('Chargement')
    const stepper = render(Stepper, { props: { step: 2 }, global: { plugins: [router] } })
    expect(stepper.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2')
    await router.push('/app/box')
    expect(render(TabBar, { global: { plugins: [router] } }).getByRole('link', { name: 'Ma Box' }).getAttribute('aria-current')).toBe('page')
    const filters = render(CatalogFilters)
    await fireEvent.update(filters.getByLabelText('Recherche'), 'gel')
    await fireEvent.click(filters.getByLabelText('Avec sodium'))
    await fireEvent.click(filters.getByRole('button', { name: 'Filtrer' }))
    const tile = render(ProductTile, { props: { product: product() }, global: { plugins: [router] } })
    expect(tile.getByText('À vérifier')).toBeTruthy()
    expect(tile.getByText(/sodium non renseigné/)).toBeTruthy()
    await fireEvent.click(tile.getByRole('button', { name: 'Ajouter à ma Box' }))
    const facts = render(ProductFacts, { props: { product: product({ verified: true, dataQuality: 'complete', servingUnit: 'ml', sugarsG: 4, energyKj: 10, carbsPer100: 50, sugarsPer100: 12, energyKjPer100: 80, sodiumPer100: 1, caffeinePer100: 2, source: 'user' }) } })
    expect(facts.getByText('Vérifié')).toBeTruthy()
    expect(facts.getByText(/version personnelle/)).toBeTruthy()
    render(ProductFacts, { props: { product: product({ source: 'manual', carbsKnown: false, caffeineKnown: false, verified: undefined, buyUrl: null, sourceUrl: null, imageCredit: null, offLastModified: null, indicativePriceEur: null }) } })
    const timeline = render(Timeline, {
      props: {
        intakes: [{ minute: 10, segment: 'effort', productId: 'p1', productName: 'Gel citron', productType: 'gel', quantity: 1, carbsG: 22, fluidMl: 0, sodiumMg: 0, caffeineMg: 0, cumulativeCarbsG: 22, cumulativeFluidMl: 0, cumulativeSodiumMg: 0 }],
        visuals: { p1: { name: 'Gel citron', type: 'gel', imagePath: null } },
      },
    })
    expect(timeline.getAllByText('Gel citron').length).toBeGreaterThan(0)
    const shopping = render(ShoppingList, {
      props: { lines: [{ productId: 'p1', name: 'Gel citron', toBring: 2, missing: 1, inBox: false, brand: 'Baouw', productType: 'gel', imagePath: 'catalog/a.webp' }] },
    })
    await fireEvent.click(shopping.getByRole('button', { name: 'Copier la liste' }))
    await fireEvent.click(shopping.getByRole('button', { name: 'Exporter le texte' }))
    expect(shopping.getAllByText(/Gel citron × 2/).length).toBeGreaterThan(0)
    cleanup()
    const catalogView = render(CatalogView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(catalogView.getAllByText('Gel citron').length).toBeGreaterThan(0)
    await fireEvent.click(catalogView.getByRole('button', { name: 'Page suivante' }))
    await fireEvent.click(catalogView.getByRole('button', { name: 'Page précédente' }))
    cleanup()
    const detail = render(ProductDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(detail.getAllByText('Gel citron').length).toBeGreaterThan(0)
    await fireEvent.click(detail.getByRole('button', { name: 'Ajouter à ma Box' }))
    await fireEvent.click(detail.getByRole('button', { name: /créer ma version/ }))
    const price = detail.getByLabelText(/Prix indicatif/)
    await fireEvent.update(price, 'abc')
    await fireEvent.click(detail.getByRole('button', { name: 'Enregistrer' }))
    await fireEvent.update(price, '')
    await fireEvent.update(detail.getByLabelText('Lien'), 'notaurl')
    await fireEvent.click(detail.getByRole('button', { name: 'Enregistrer' }))
    await fireEvent.update(detail.getByLabelText('Lien'), 'https://exemple.fr/gel')
    await fireEvent.click(detail.getByRole('button', { name: 'Enregistrer' }))
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', { type: 'image/png' })
    const bad = new File([new Uint8Array([1, 2, 3])], 'photo.gif', { type: 'image/gif' })
    const input = detail.getByLabelText('Photo')
    await fireEvent.change(input, { target: { files: [bad] } })
    await fireEvent.change(input, { target: { files: [file] } })
    cleanup()
    const review = render(AdminReviewView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await review.findByRole('button', { name: 'Marquer comme vérifié' })
    await fireEvent.click(review.getByRole('button', { name: 'Marquer comme vérifié' }))
    const fields = review.getAllByRole('textbox')
    await fireEvent.update(fields[0]!, 'p1')
    await fireEvent.update(fields[1]!, 'p2')
    await fireEvent.click(review.getByRole('button', { name: 'Fusionner' }))
    await fireEvent.click(review.getByRole('button', { name: 'Promouvoir dans le catalogue' }))
  })

  it('couvre une fiche introuvable', async () => {
    const { pinia, router } = piniaRouter()
    const catalog = useCatalogStore()
    catalog.open = (async () => null) as typeof catalog.open
    const detail = render(ProductDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(detail.getByText('Produit introuvable')).toBeTruthy()
  })
})
