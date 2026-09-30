export interface RuntimeConfig {
  supabaseUrl: string
  supabaseAnonKey: string
}

declare global {
  interface Window {
    __RAVITOBOX_CONFIG__?: Partial<RuntimeConfig>
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  const runtime = typeof window === 'undefined' ? undefined : window.__RAVITOBOX_CONFIG__
  const supabaseUrl = runtime?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = runtime?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return { supabaseUrl, supabaseAnonKey }
}

export function assertRuntimeConfig(): RuntimeConfig {
  const config = getRuntimeConfig()
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Configuration Supabase manquante. Le fichier config.js doit être généré au démarrage.')
  }
  return config
}
