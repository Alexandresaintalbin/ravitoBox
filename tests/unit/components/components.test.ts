import { describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import AppDisclaimer from '@/components/AppDisclaimer.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import FormField from '@/components/FormField.vue'
import QuantityInput from '@/components/QuantityInput.vue'
import WarningList from '@/components/WarningList.vue'
import ProductCard from '@/components/ProductCard.vue'
import Timeline from '@/components/Timeline.vue'
import ShoppingList from '@/components/ShoppingList.vue'
import SensationScale from '@/components/SensationScale.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import AppLogo from '@/components/AppLogo.vue'
import type { Product } from '@/lib/mappers'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

function pinia() {
  const store = createPinia()
  setActivePinia(store)
  return store
}

describe('composants', () => {
  it('affiche alertes, vide, chargement et avertissements', () => {
    const alert = render(AppAlert, { props: { message: 'Oups' } })
    expect(alert.getByRole('alert').textContent).toContain('Oups')
    expect(render(AppDisclaimer).getByRole('note').textContent).toContain('diététicien')
    expect(render(AppSpinner).getByRole('status').textContent).toContain('Chargement')
    expect(render(EmptyState, { props: { title: 'Vide', text: 'Rien' } }).getByText('Vide')).toBeTruthy()
    expect(render(FormField, { props: { label: 'Nom', error: 'requis', hint: 'aide' }, slots: { default: '<input />' } }).getByText('requis')).toBeTruthy()
    const warnings = render(WarningList, { props: { warnings: [{ code: 'X', message: 'Attention' }] } })
    expect(warnings.getByText('Attention')).toBeTruthy()
    cleanup()
    expect(render(WarningList, { props: { warnings: [] } }).queryByRole('list')).toBeNull()
  })

  it('change une quantité, une sensation et le thème', async () => {
    const qty = render(QuantityInput, { props: { modelValue: 1, 'onUpdate:modelValue': () => undefined } })
    await fireEvent.click(qty.getByRole('button', { name: 'Augmenter la quantité' }))
    await fireEvent.click(qty.getByRole('button', { name: 'Diminuer la quantité' }))
    const scale = render(SensationScale, { props: { label: 'Énergie', modelValue: 3, 'onUpdate:modelValue': () => undefined } })
    await fireEvent.click(scale.getByRole('button', { name: '5' }))
    const theme = render(ThemeToggle, { global: { plugins: [pinia()] } })
    await fireEvent.click(theme.getByRole('button', { name: /Thème/ }))
    expect(render(AppLogo).container.querySelector('svg')).toBeTruthy()
  })

  it('rend un produit, une frise et une liste de courses', async () => {
    const product: Product = {
      id: 'p1',
      name: 'Gel citron',
      brand: 'Maison',
      type: 'gel',
      flavor: 'citron',
      carbsG: 22,
      sodiumMg: 40,
      caffeineMg: 10,
      volumeMl: 40,
      scope: 'custom',
      ownerId: 'u',
    }
    const card = render(ProductCard, { props: { product, preferred: true } })
    expect(card.getByText('Gel citron')).toBeTruthy()
    await fireEvent.click(card.getByRole('button', { name: 'Ajouter à la Box' }))
    await fireEvent.click(card.getByRole('button', { name: 'Supprimer' }))
    const timeline = render(Timeline, {
      props: {
        intakes: [
          {
            minute: 20,
            segment: 'effort',
            productId: 'p1',
            productName: 'Gel citron',
            productType: 'gel',
            quantity: 1,
            carbsG: 22,
            fluidMl: 0,
            sodiumMg: 40,
            caffeineMg: 0,
            cumulativeCarbsG: 22,
            cumulativeFluidMl: 0,
            cumulativeSodiumMg: 40,
          },
        ],
      },
    })
    expect(timeline.getAllByText('Gel citron').length).toBeGreaterThan(0)
    expect(render(Timeline, { props: { intakes: [] } }).getByText('Aucune prise pour le moment.')).toBeTruthy()
    const shopping = render(ShoppingList, {
      props: { lines: [{ productId: 'p1', name: 'Gel citron', toBring: 2, missing: 1, inBox: true }] },
    })
    expect(shopping.getByText(/Gel citron × 2/)).toBeTruthy()
    expect(render(ShoppingList, { props: { lines: [] } }).getByText(/Rien à emporter/)).toBeTruthy()
    await router.push('/')
  })
})
