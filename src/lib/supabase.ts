import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assertRuntimeConfig } from '@/lib/config'
import type { Database } from '@/types/database'

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client
  const { supabaseUrl, supabaseAnonKey } = assertRuntimeConfig()
  client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}

export function resetSupabaseClient(): void {
  client = null
}
