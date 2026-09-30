import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { applyTheme, preferredTheme, useTheme } from '@/composables/useTheme'
import { useAsync } from '@/composables/useAsync'
import { clearDraft, readDraft, usePlanDraft, writeDraft } from '@/composables/usePlanDraft'
import { filterProducts, useProductFilters } from '@/composables/useProductFilters'
import { applyTriFormat, durationOf, emptyOuting, useOuting } from '@/composables/useOuting'
import { ref } from 'vue'

describe('thème', () => {
  it('suit le stockage, la préférence système, puis bascule', async () => {
    localStorage.clear()
    window.matchMedia = () => ({ matches: true }) as MediaQueryList
    expect(preferredTheme()).toBe('dark')
    localStorage.setItem('ravitobox-theme', 'light')
    expect(preferredTheme()).toBe('light')
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    const Host = defineComponent({ setup: () => useTheme(), template: '<button @click="toggle">{{ theme }}</button>' })
    const wrapper = mount(Host)
    expect(wrapper.text()).toBe('dark')
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toBe('light')
    window.matchMedia = () => ({ matches: false }) as MediaQueryList
    localStorage.removeItem('ravitobox-theme')
    expect(preferredTheme()).toBe('light')
    const originalWindow = globalThis.window
    vi.stubGlobal('window', undefined)
    expect(preferredTheme()).toBe('light')
    vi.unstubAllGlobals()
    globalThis.window = originalWindow
  })
})

describe('useAsync', () => {
  it('mémorise le succès, l’erreur et la remise à zéro', async () => {
    const state = useAsync<string>()
    const ok = await state.run(async () => 'prêt')
    expect(ok).toBe('prêt')
    expect(state.data.value).toBe('prêt')
    expect(state.loading.value).toBe(false)
    const failed = await state.run(async () => {
      throw new Error('Failed to fetch')
    })
    expect(failed).toBeNull()
    expect(state.error.value).toContain('injoignable')
    state.reset()
    expect(state.data.value).toBeNull()
  })
})

describe('brouillon de sortie', () => {
  it('ignore un stockage illisible et réinitialise le formulaire', async () => {
    localStorage.setItem('ravitobox-outing-draft', '{')
    expect(readDraft()).toBeNull()
    writeDraft(emptyOuting())
    expect(readDraft()?.sport).toBe('course')
    localStorage.setItem('ravitobox-outing-draft', 'null')
    expect(readDraft()).toBeNull()
    writeDraft(emptyOuting())
    const draft = usePlanDraft(emptyOuting(70))
    draft.form.value.title = 'Ultra'
    await nextTick()
    expect(readDraft()?.title).toBe('Ultra')
    draft.reset()
    expect(readDraft()).toBeNull()
    clearDraft()
  })
})

describe('filtres produits', () => {
  const products = [
    { name: 'Gel citron', type: 'gel', flavor: 'citron' },
    { name: 'Barre', type: 'barre', flavor: 'chocolat' },
    { name: 'Eau', type: 'eau', flavor: null },
  ]

  it('filtre, cherche et remonte les saveurs préférées', () => {
    expect(filterProducts(products, { type: 'gel', flavor: 'toutes', query: '' }, []).map((item) => item.name)).toEqual(['Gel citron'])
    expect(filterProducts(products, { type: 'tous', flavor: 'chocolat', query: 'bar' }, ['chocolat'])[0]?.name).toBe('Barre')
    expect(filterProducts(products, { type: 'tous', flavor: 'toutes', query: '' }, ['chocolat'])[0]?.flavor).toBe('chocolat')
    const source = ref(products)
    const preferred = ref(['citron'])
    const filters = useProductFilters(source, preferred)
    filters.query.value = 'eau'
    expect(filters.filtered.value).toHaveLength(1)
  })
})

describe('sortie', () => {
  it('préremplit un triathlon, refuse une durée nulle et construit un plan', () => {
    const form = applyTriFormat(emptyOuting(), 'sprint')
    expect(form.sport).toBe('triathlon')
    expect(durationOf(form)).toBeGreaterThan(0)
    const outing = useOuting(emptyOuting())
    outing.refreshGut([])
    expect(outing.gut.value).toBeNull()
    outing.acceptGut(true)
    outing.ignoreGut()
    expect(outing.generate([])).toBe(true)
    expect(outing.plan.value).not.toBeNull()
    outing.form.value.hours = 0
    outing.form.value.minutes = 0
    expect(outing.generate([])).toBe(false)
    expect(outing.fieldErrors.value.hours).toBeTruthy()
    outing.form.value = applyTriFormat(emptyOuting(), 'triathlon_70_3')
    outing.form.value.elevationM = 0
    expect(outing.generate([])).toBe(true)
    outing.form.value.sport = 'trail'
    outing.form.value.elevationM = null
    outing.form.value.triFormat = null
    expect(outing.generate([])).toBe(false)
  })

  it('applique une proposition de gut training seulement après confirmation si besoin', () => {
    const outing = useOuting(emptyOuting())
    outing.refreshGut([
      { carbsGPerHourConsumed: 70, stomach: 5, energy: 5, thirst: 3, durationMinutes: 120 },
    ])
    outing.form.value.toleranceGPerHour = 75
    outing.refreshGut([
      { carbsGPerHourConsumed: 70, stomach: 5, energy: 5, thirst: 3, durationMinutes: 120 },
    ])
    outing.acceptGut(false)
    expect(outing.form.value.carbOverrideGPerHour).toBe(75)
    outing.acceptGut(true)
    expect(outing.form.value.allowExceedTolerance).toBe(true)
    outing.form.value.fluidOverrideMlPerHour = 700
    outing.form.value.sodiumOverrideMgPerHour = 650
    outing.form.value.hours = 2
    outing.form.value.minutes = 0
    outing.form.value.sport = 'course'
    expect(outing.generate([])).toBe(true)
    expect(outing.targets.value?.fluidMlPerHour).toBe(700)
    expect(outing.targets.value?.sodiumMgPerHour).toBe(650)
  })
})
