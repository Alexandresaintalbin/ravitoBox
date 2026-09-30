import { ref, watch } from 'vue'
import type { OutingFormInput } from '@/schemas/outing'

const STORAGE_KEY = 'ravitobox-outing-draft'

export function readDraft(): Partial<OutingFormInput> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OutingFormInput>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function writeDraft(value: OutingFormInput) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export function clearDraft() {
  window.localStorage.removeItem(STORAGE_KEY)
}

export function usePlanDraft(initial: OutingFormInput) {
  const form = ref<OutingFormInput>({ ...initial, ...readDraft() })
  watch(form, (value) => writeDraft(value), { deep: true })
  function reset() {
    form.value = { ...initial }
    clearDraft()
  }
  return { form, reset }
}
