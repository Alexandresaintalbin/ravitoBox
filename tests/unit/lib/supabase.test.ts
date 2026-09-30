import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: { persist: true } })))

vi.mock('@supabase/supabase-js', () => ({ createClient }))

import { getSupabase, resetSupabaseClient } from '@/lib/supabase'

describe('client Supabase', () => {
  beforeEach(() => {
    resetSupabaseClient()
    createClient.mockClear()
    window.__RAVITOBOX_CONFIG__ = { supabaseUrl: '', supabaseAnonKey: '' }
  })

  it('refuse de démarrer sans configuration', () => {
    expect(() => getSupabase()).toThrow(/manquante/)
  })

  it('crée un client une seule fois puis le réinitialise', () => {
    window.__RAVITOBOX_CONFIG__ = { supabaseUrl: 'http://localhost:8000', supabaseAnonKey: 'anon-key' }
    const first = getSupabase()
    const second = getSupabase()
    expect(first).toBe(second)
    expect(createClient).toHaveBeenCalledTimes(1)
    resetSupabaseClient()
    getSupabase()
    expect(createClient).toHaveBeenCalledTimes(2)
  })
})
