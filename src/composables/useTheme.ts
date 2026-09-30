import { ref, watch } from 'vue'

export type ThemeName = 'light' | 'dark'

const STORAGE_KEY = 'ravitobox-theme'

export function preferredTheme(): ThemeName {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  if (typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem(STORAGE_KEY, theme)
}

export function useTheme() {
  const theme = ref<ThemeName>(preferredTheme())
  applyTheme(theme.value)

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  watch(theme, (value) => applyTheme(value))
  return { theme, toggle }
}
