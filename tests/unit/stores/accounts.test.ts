import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createInvitationCode, parseSignupPolicy, useAccountsStore } from '@/stores/accounts'

const { rpc, from } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ rpc, from }),
}))

function query(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  for (const method of ['select', 'insert', 'update', 'eq', 'order']) builder[method] = vi.fn(chain)
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return builder
}

describe('comptes administrés', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('interprète la politique d’inscription', () => {
    expect(parseSignupPolicy(null)).toEqual({ mode: 'closed', emailConfirmation: true })
    expect(parseSignupPolicy([])).toEqual({ mode: 'closed', emailConfirmation: true })
    expect(parseSignupPolicy({ mode: 'open', email_confirmation: false })).toEqual({
      mode: 'open',
      emailConfirmation: false,
    })
    expect(createInvitationCode()).toMatch(/^[A-Z2-9]{10}$/)
  })

  it('liste, crée et désactive des comptes et des codes', async () => {
    const account = {
      id: 'user-2',
      email: 'bruno@exemple.fr',
      pseudo: 'Bruno',
      role: 'user',
      active: true,
      created_at: '2026-01-01T00:00:00.000Z',
    }
    const invitation = {
      id: 'inv-1',
      code: 'ABCD234567',
      note: null,
      active: true,
      max_uses: 1,
      use_count: 0,
      expires_at: null,
      created_by: null,
      created_at: '2026-01-01T00:00:00.000Z',
    }
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'admin_list_accounts') return { data: [account], error: null }
      return { data: 'user-2', error: null }
    })
    from.mockImplementation(() => query({ data: [invitation], error: null }))
    const store = useAccountsStore()
    await store.load()
    expect(store.accounts[0]?.email).toBe('bruno@exemple.fr')
    await store.createAccount({ email: 'bruno@exemple.fr', password: 'secret123', pseudo: 'Bruno' })
    await store.setActive('user-2', false)
    await store.loadInvitations()
    expect(store.invitations[0]?.code).toBe('ABCD234567')
    await store.createInvitation('club', 2)
    await store.setInvitationActive('inv-1', false)
    store.clearError()
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied', code: '42501' } })
    await expect(store.load()).rejects.toBeTruthy()
    expect(store.error).toContain('droit')
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await store.load()
    expect(store.accounts).toEqual([])
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'duplicate', code: '23505' } })
    await expect(store.createAccount({ email: 'bruno@exemple.fr', password: 'secret123', pseudo: 'Bruno' })).rejects.toBeTruthy()
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied', code: '42501' } })
    await expect(store.setActive('user-2', true)).rejects.toBeTruthy()
    from.mockImplementation(() => query({ data: null, error: { message: 'network' } }))
    await expect(store.loadInvitations()).rejects.toBeTruthy()
    await expect(store.createInvitation('club', 1)).rejects.toBeTruthy()
    await expect(store.setInvitationActive('inv-1', true)).rejects.toBeTruthy()
    from.mockImplementation(() => query({ data: null, error: null }))
    await store.loadInvitations()
    expect(store.invitations).toEqual([])
  })
})
