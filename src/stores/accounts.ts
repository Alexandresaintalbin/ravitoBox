import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getSupabase } from '@/lib/supabase'
import { toUserMessage } from '@/lib/errors'
import type { Database } from '@/types/database'

export type SignupMode = 'closed' | 'invite' | 'open'

export interface SignupPolicy {
  mode: SignupMode
  emailConfirmation: boolean
}

export interface ManagedAccount {
  id: string
  email: string
  pseudo: string
  role: 'user' | 'admin'
  active: boolean
  createdAt: string
}

export interface Invitation {
  id: string
  code: string
  note: string | null
  active: boolean
  maxUses: number
  useCount: number
  expiresAt: string | null
  createdAt: string
}

type InvitationRow = Database['public']['Tables']['invitations']['Row']

function asMode(value: unknown): SignupMode {
  if (value === 'invite' || value === 'open' || value === 'closed') return value
  return 'closed'
}

export function parseSignupPolicy(payload: unknown): SignupPolicy {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { mode: 'closed', emailConfirmation: true }
  }
  const record = payload as { mode?: unknown; email_confirmation?: unknown }
  return {
    mode: asMode(record.mode),
    emailConfirmation: record.email_confirmation !== false,
  }
}

function mapInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    code: row.code,
    note: row.note,
    active: row.active,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export function createInvitationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref<ManagedAccount[]>([])
  const invitations = ref<Invitation[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function clearError() {
    error.value = null
  }

  async function run<T>(action: () => Promise<T>): Promise<T> {
    loading.value = true
    error.value = null
    try {
      return await action()
    } catch (cause) {
      error.value = toUserMessage(cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  function load() {
    return run(async () => {
      const { data, error: queryError } = await getSupabase().rpc('admin_list_accounts')
      if (queryError) throw queryError
      accounts.value = (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        pseudo: row.pseudo,
        role: row.role,
        active: row.active,
        createdAt: row.created_at,
      }))
    })
  }

  function createAccount(input: { email: string; password: string; pseudo: string }) {
    return run(async () => {
      const { error: queryError } = await getSupabase().rpc('admin_create_account', {
        p_email: input.email,
        p_password: input.password,
        p_pseudo: input.pseudo,
      })
      if (queryError) throw queryError
      await load()
    })
  }

  function setActive(userId: string, active: boolean) {
    return run(async () => {
      const { error: queryError } = await getSupabase().rpc('admin_set_account_active', {
        p_user_id: userId,
        p_active: active,
      })
      if (queryError) throw queryError
      await load()
    })
  }

  function loadInvitations() {
    return run(async () => {
      const { data, error: queryError } = await getSupabase()
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false })
      if (queryError) throw queryError
      invitations.value = (data ?? []).map(mapInvitation)
    })
  }

  function createInvitation(note: string, maxUses: number) {
    return run(async () => {
      const { error: queryError } = await getSupabase().from('invitations').insert({
        code: createInvitationCode(),
        note: note.trim() || null,
        max_uses: maxUses,
      })
      if (queryError) throw queryError
      await loadInvitations()
    })
  }

  function setInvitationActive(id: string, active: boolean) {
    return run(async () => {
      const { error: queryError } = await getSupabase().from('invitations').update({ active }).eq('id', id)
      if (queryError) throw queryError
      await loadInvitations()
    })
  }

  return {
    accounts,
    invitations,
    loading,
    error,
    clearError,
    load,
    createAccount,
    setActive,
    loadInvitations,
    createInvitation,
    setInvitationActive,
  }
})
