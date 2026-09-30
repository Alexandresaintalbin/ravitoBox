import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useBoxStore } from '@/stores/box'
import { usePlansStore } from '@/stores/plans'
import { adjustmentsFor, snapshotsFrom, useDebriefStore } from '@/stores/debriefs'
import { useBadgeStore } from '@/stores/badges'
import type { SavedPlan } from '@/stores/plans'
import { emptyOuting } from '@/composables/useOuting'

const { authMock, fromMock, rpcMock } = vi.hoisted(() => ({
  authMock: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ auth: authMock, from: fromMock, rpc: rpcMock }),
}))

function query(list: unknown, single: unknown = null, error: { message: string; code?: string; status?: number } | null = null) {
  const listResult = { data: error ? null : list, error }
  const singleResult = { data: error ? null : single, error }
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  for (const method of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order']) {
    builder[method] = vi.fn(chain)
  }
  builder.single = vi.fn(async () => singleResult)
  builder.maybeSingle = vi.fn(async () => singleResult)
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return builder
}

const profileRow = {
  id: 'user-1',
  pseudo: 'Ada',
  weight_kg: 60,
  primary_sport: 'course',
  tolerance_g_per_h: 60,
  preferred_flavors: ['citron'],
  role: 'user',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const productRow = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Gel',
  brand: null,
  product_type: 'gel',
  flavor: 'citron',
  carbs_g: 22,
  sodium_mg: 40,
  caffeine_mg: 0,
  volume_ml: null,
  scope: 'catalog',
  owner_id: null,
  created_at: '',
  updated_at: '',
}

const planRow = {
  id: 'plan-1',
  user_id: 'user-1',
  title: 'Sortie',
  sport: 'course',
  session_type: 'entrainement',
  parameters: { ...emptyOuting(), durationMinutes: 150 },
  targets: { carbsGPerHour: 60, fluidMlPerHour: 500, sodiumMgPerHour: 400, uncappedCarbsGPerHour: 60, eventMinutes: 150, fuelingMinutes: 150, warnings: [] },
  generated_plan: { intakes: [{ productId: productRow.id, carbsG: 22 }], totals: { carbsG: 22, fluidMl: 0, sodiumMg: 0, caffeineMg: 0 }, targetsTotal: { carbsG: 100, fluidMl: 0, sodiumMg: 0 }, coverage: { carbs: 0.2, fluid: 1, sodium: 1 }, shoppingList: [], segments: [], warnings: [] },
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

function installBackend(error: { message: string; code?: string; status?: number } | null = null) {
  fromMock.mockImplementation((table: string) => {
    if (table === 'profiles') return query(profileRow, profileRow, error)
    if (table === 'products') return query([productRow], productRow, error)
    if (table === 'box_items') return query([{ product_id: productRow.id, quantity: 2, excluded: false }], null, error)
    if (table === 'favorites') return query([{ product_id: productRow.id }], null, error)
    if (table === 'plans') return query([planRow], planRow, error)
    if (table === 'debriefs') {
      return query(
        [{ id: 'd1', plan_id: 'plan-1', energy: 4, stomach: 5, thirst: 3, notes: null, consumed: [{ productId: productRow.id, productName: 'Gel', quantity: 1 }], created_at: '2026-01-02' }],
        { id: 'd1', plan_id: 'plan-1', energy: 4, stomach: 5, thirst: 3, notes: 'ok', consumed: [], created_at: '2026-01-02' },
        error,
      )
    }
    if (table === 'badges') return query([{ id: 'premiere-sortie', name: 'Première', description: 'ok', icon: 'box' }], null, error)
    if (table === 'user_badges') return query([{ badge_id: 'premiere-sortie', earned_at: '2026-01-03' }], null, error)
    return query([], null, error)
  })
}

describe('stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    installBackend()
    authMock.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1', identities: [{ id: 'i' }] } } }, error: null })
    authMock.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
  })

  it('connecte, charge le profil et couvre les actions du compte', async () => {
    let listener: (event: string, session: { user: { id: string } } | null) => void = () => undefined
    authMock.onAuthStateChange.mockImplementation(((callback: (event: string, session: { user: { id: string } } | null) => void) => {
      listener = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }) as never)
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    await auth.init()
    await auth.init()
    listener('SIGNED_OUT', null)
    expect(auth.profile).toBeNull()
    listener('SIGNED_IN', { user: { id: 'user-1' } })
    await auth.loadProfile()
    expect(auth.ready).toBe(true)
    expect(auth.profile?.pseudo).toBe('Ada')
    expect(auth.isAdmin).toBe(false)
    auth.clearError()

    authMock.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null })
    await expect(auth.signUp({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'Ada' })).rejects.toBeTruthy()
    authMock.signUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i' }] }, session: null }, error: null })
    await expect(auth.signUp({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'Ada' })).resolves.toEqual({ needsConfirmation: true })
    rpcMock.mockResolvedValueOnce({ data: { mode: 'invite', email_confirmation: false }, error: null })
    await expect(auth.loadSignupPolicy()).resolves.toEqual({ mode: 'invite', emailConfirmation: false })
    rpcMock.mockResolvedValueOnce({ data: { mode: 'inconnu' }, error: null })
    await expect(auth.loadSignupPolicy()).resolves.toEqual({ mode: 'closed', emailConfirmation: true })
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'network' } })
    await expect(auth.loadSignupPolicy()).rejects.toBeTruthy()
    authMock.signUp.mockResolvedValue({ data: {}, error: { message: 'Failed to fetch' } })
    await expect(auth.signUp({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'Ada' })).rejects.toBeTruthy()

    authMock.signInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    await auth.signIn({ email: 'ada@exemple.fr', password: 'secret123' })
    authMock.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    await expect(auth.signIn({ email: 'ada@exemple.fr', password: 'nope' })).rejects.toBeTruthy()

    authMock.signOut.mockResolvedValue({ error: null })
    await auth.signOut()
    expect(auth.user).toBeNull()
    authMock.signOut.mockResolvedValue({ error: { message: 'network' } })
    await expect(auth.signOut()).rejects.toBeTruthy()

    authMock.resetPasswordForEmail.mockResolvedValue({ error: null })
    await auth.requestPasswordReset('ada@exemple.fr')
    authMock.resetPasswordForEmail.mockResolvedValue({ error: { message: 'network' } })
    await expect(auth.requestPasswordReset('ada@exemple.fr')).rejects.toBeTruthy()

    authMock.updateUser.mockResolvedValue({ error: null })
    await auth.updatePassword({ password: 'secret123', confirm: 'secret123' })
    await auth.updateEmail({ email: 'ada@exemple.fr' })
    authMock.updateUser.mockResolvedValue({ error: { message: 'Password should be longer' } })
    await expect(auth.updatePassword({ password: 'secret123', confirm: 'secret123' })).rejects.toBeTruthy()

    auth.user = { id: 'user-1' } as never
    await auth.updateProfile({ pseudo: 'Ada', weightKg: null, primarySport: 'course', toleranceGPerHour: 70, preferredFlavors: ['citron'] })
    auth.user = null
    await expect(auth.updateProfile({ pseudo: 'Ada', weightKg: null, primarySport: null, toleranceGPerHour: 60, preferredFlavors: [] })).rejects.toBeTruthy()

    auth.user = { id: 'user-1' } as never
    rpcMock.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } })
    await expect(auth.deleteAccount()).rejects.toBeTruthy()
    expect(auth.user).not.toBeNull()
    rpcMock.mockResolvedValue({ error: null })
    authMock.signOut.mockResolvedValue({ error: null })
    await auth.deleteAccount()
    expect(auth.profile).toBeNull()

    auth.user = { id: 'user-1' } as never
    const exported = await auth.exportData()
    expect(exported.profile).toBeTruthy()
    installBackend({ message: 'JWT expired', status: 401 })
    await expect(auth.exportData()).rejects.toBeTruthy()
  })

  it('signale une session illisible et une déconnexion temps réel', async () => {
    authMock.getSession.mockRejectedValue(new Error('Failed to fetch'))
    const auth = useAuthStore()
    await auth.init()
    expect(auth.ready).toBe(true)
    expect(auth.error).toContain('injoignable')
  })

  it('gère la Box, les favoris et les produits', async () => {
    const auth = useAuthStore()
    auth.user = { id: 'user-1' } as never
    const box = useBoxStore()
    await box.load()
    expect(box.entries).toHaveLength(1)
    expect(box.catalog).toHaveLength(1)
    box.clearError()
    await box.addProduct(productRow.id, 2)
    await box.updateItem(productRow.id, { quantity: 3 })
    await box.updateItem(productRow.id, { excluded: true })
    await box.removeItem(productRow.id)
    await box.toggleFavorite(productRow.id, true)
    await box.toggleFavorite(productRow.id, false)
    const created = await box.saveProduct(
      { name: 'Maison', brand: null, productType: 'gel', flavor: 'citron', carbsG: 20, sodiumMg: 10, caffeineMg: 0, volumeMl: null },
      'custom',
    )
    expect(created.name).toBe('Gel')
    await box.saveProduct(
      { name: 'Maison', brand: null, productType: 'gel', flavor: null, carbsG: 20, sodiumMg: 10, caffeineMg: 0, volumeMl: null },
      'catalog',
      productRow.id,
    )
    await box.deleteProduct(productRow.id)
    await box.copyProduct(productRow.id)
    await expect(box.copyProduct('absent')).rejects.toBeTruthy()
    auth.user = null
    await expect(box.addProduct(productRow.id)).rejects.toBeTruthy()
    installBackend({ message: 'duplicate', code: '23505' })
    auth.user = { id: 'user-1' } as never
    await expect(box.load()).rejects.toBeTruthy()
  })

  it('enregistre, ouvre, duplique et supprime un plan', async () => {
    const auth = useAuthStore()
    auth.user = { id: 'user-1' } as never
    const plans = usePlansStore()
    await plans.list()
    expect(plans.plans).toHaveLength(1)
    await plans.open('plan-1')
    expect(plans.current?.title).toBe('Sortie')
    const saved = await plans.save({
      form: emptyOuting(),
      durationMinutes: 150,
      targets: planRow.targets as never,
      plan: planRow.generated_plan as never,
    })
    expect(saved.id).toBe('plan-1')
    const copy = await plans.duplicate('plan-1')
    expect(copy.id).toBe('plan-1')
    await plans.remove('plan-1')
    expect(plans.current).toBeNull()
    plans.clearError()
    auth.user = null
    await expect(plans.save({ form: emptyOuting(), durationMinutes: 10, targets: planRow.targets as never, plan: planRow.generated_plan as never })).rejects.toBeTruthy()
    installBackend({ message: 'introuvable' })
    await expect(plans.open('missing')).rejects.toBeTruthy()
  })

  it('crée un débrief et propose des ajustements', async () => {
    const auth = useAuthStore()
    auth.user = { id: 'user-1' } as never
    const plans = usePlansStore()
    plans.plans = [
      {
        id: 'plan-1',
        title: 'Sortie',
        sport: 'course',
        sessionType: 'entrainement',
        parameters: { ...emptyOuting(), durationMinutes: 150 },
        targets: planRow.targets as SavedPlan['targets'],
        generatedPlan: planRow.generated_plan as unknown as SavedPlan['generatedPlan'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    const debriefs = useDebriefStore()
    await debriefs.list('plan-1')
    await debriefs.list()
    const created = await debriefs.create('plan-1', { energy: 4, stomach: 5, thirst: 3, notes: '', consumed: [] })
    expect(created.stomach).toBe(5)
    expect(debriefs.historyForGut()[0]?.durationMinutes).toBe(150)
    const snaps = snapshotsFrom(debriefs.items, [])
    expect(snaps[0]?.carbsGPerHourConsumed).toBe(0)
    expect(
      adjustmentsFor(plans.plans[0] as SavedPlan, { energy: 2, stomach: 5, thirst: 5, notes: '', consumed: [] }, 90).length,
    ).toBeGreaterThan(0)
    debriefs.clearError()
    auth.user = null
    await expect(debriefs.create('plan-1', { energy: 3, stomach: 3, thirst: 3, notes: '', consumed: [] })).rejects.toBeTruthy()
    installBackend({ message: 'permission denied', code: '42501' })
    auth.user = { id: 'user-1' } as never
    await expect(debriefs.list()).rejects.toBeTruthy()
  })

  it('couvre les branches d’erreur restantes', async () => {
    const auth = useAuthStore()
    auth.user = null
    await auth.loadProfile()
    expect(auth.profile).toBeNull()
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'JWT expired', status: 401 } })
    await auth.init()
    expect(auth.error).toContain('expiré')

    let listener: (event: string, session: { user: { id: string } } | null) => void = () => undefined
    authMock.onAuthStateChange.mockImplementation(((callback: (event: string, session: { user: { id: string } } | null) => void) => {
      listener = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }) as never)
    setActivePinia(createPinia())
    installBackend({ message: 'permission denied', code: '42501' })
    authMock.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null })
    const second = useAuthStore()
    await second.init()
    listener('SIGNED_IN', { user: { id: 'user-1' } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(second.error).toBeTruthy()

    setActivePinia(createPinia())
    installBackend()
    const plans = usePlansStore()
    const userAuth = useAuthStore()
    userAuth.user = { id: 'user-1' } as never
    fromMock.mockImplementation(() => query(null, null))
    await expect(plans.open('absent')).rejects.toBeTruthy()
    plans.current = { id: 'autre' } as never
    await plans.remove('plan-1')
    expect(plans.current).toMatchObject({ id: 'autre' })
    await expect(plans.duplicate('plan-1')).rejects.toBeTruthy()

    const badges = useBadgeStore()
    rpcMock.mockResolvedValueOnce({ error: null })
    fromMock.mockImplementation((table: string) => {
      if (table === 'badges') {
        return query(
          [
            { id: 'premiere-sortie', name: 'A', description: 'a', icon: 'box' },
            { id: 'objectif', name: 'B', description: 'b', icon: 'flag' },
          ],
          null,
        )
      }
      if (table === 'user_badges') return query([{ badge_id: 'premiere-sortie', earned_at: '2026-01-01' }], null)
      return query([], null)
    })
    await badges.sync()
    expect(badges.badges.find((badge) => badge.id === 'objectif')?.earnedAt).toBeNull()

    const debriefs = useDebriefStore()
    userAuth.user = { id: 'user-1' } as never
    fromMock.mockImplementation(() =>
      query([], { id: 'd2', plan_id: 'plan-1', energy: 3, stomach: 3, thirst: 3, notes: 'bien', consumed: [], created_at: '2026-02-01' }),
    )
    await debriefs.create('plan-1', {
      energy: 3,
      stomach: 3,
      thirst: 3,
      notes: 'bien',
      consumed: [],
    })
  })

  it('propage une erreur ciblée pour chaque requête', async () => {
    const auth = useAuthStore()
    auth.user = { id: 'user-1' } as never
    const box = useBoxStore()
    const plans = usePlansStore()
    const fail = (tableName: string) => {
      fromMock.mockImplementation((table: string) =>
        query(table === tableName ? null : [], table === tableName ? null : profileRow, table === tableName ? { message: 'permission denied', code: '42501' } : null),
      )
    }
    for (const table of ['products', 'box_items', 'favorites']) {
      fail(table)
      await expect(box.load()).rejects.toBeTruthy()
    }
    fail('box_items')
    await expect(box.addProduct(productRow.id)).rejects.toBeTruthy()
    await expect(box.updateItem(productRow.id, {})).rejects.toBeTruthy()
    await expect(box.removeItem(productRow.id)).rejects.toBeTruthy()
    await expect(box.toggleFavorite(productRow.id, true)).rejects.toBeTruthy()
    await expect(box.toggleFavorite(productRow.id, false)).rejects.toBeTruthy()
    fail('products')
    await expect(
      box.saveProduct(
        { name: 'Maison', brand: null, productType: 'gel', flavor: null, carbsG: 1, sodiumMg: 1, caffeineMg: 0, volumeMl: null },
        'custom',
        productRow.id,
      ),
    ).rejects.toBeTruthy()
    await expect(box.deleteProduct(productRow.id)).rejects.toBeTruthy()
    auth.user = null
    await expect(box.updateItem(productRow.id, { quantity: 1 })).rejects.toBeTruthy()
    await expect(box.removeItem(productRow.id)).rejects.toBeTruthy()
    await expect(box.toggleFavorite(productRow.id, true)).rejects.toBeTruthy()
    await expect(
      box.saveProduct(
        { name: 'Maison', brand: null, productType: 'gel', flavor: null, carbsG: 1, sodiumMg: 1, caffeineMg: 0, volumeMl: null },
        'catalog',
      ),
    ).rejects.toBeTruthy()
    auth.user = { id: 'user-1' } as never
    fromMock.mockImplementation(() => query(null, null))
    await box.load()
    expect(box.entries).toEqual([])
    fail('favorites')
    await expect(box.toggleFavorite(productRow.id, false)).rejects.toBeTruthy()

    fail('plans')
    await expect(plans.list()).rejects.toBeTruthy()
    await expect(plans.open('plan-1')).rejects.toBeTruthy()
    await expect(
      plans.save({ form: emptyOuting(), durationMinutes: 30, targets: planRow.targets as never, plan: planRow.generated_plan as never }),
    ).rejects.toBeTruthy()
    await expect(plans.duplicate('plan-1')).rejects.toBeTruthy()
    await expect(plans.remove('plan-1')).rejects.toBeTruthy()
    auth.user = null
    installBackend()
    await expect(plans.duplicate('plan-1')).rejects.toBeTruthy()

    auth.user = { id: 'user-1' } as never
    fromMock.mockImplementation(() => query(null, null))
    const exported = await auth.exportData()
    expect(exported.customProducts).toEqual([])
    authMock.updateUser.mockResolvedValueOnce({ error: { message: 'Email rate limit' } })
    await expect(auth.updateEmail({ email: 'ada@exemple.fr' })).rejects.toBeTruthy()
    authMock.signUp.mockResolvedValueOnce({ data: { session: null }, error: null })
    await expect(auth.signUp({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'Ada' })).resolves.toEqual({
      needsConfirmation: true,
    })
    fromMock.mockImplementation(() => query(null, null))
    await auth.loadProfile()
    expect(auth.profile).toBeNull()

    const badges = useBadgeStore()
    rpcMock.mockResolvedValue({ error: null })
    fromMock.mockImplementation((table: string) => {
      if (table === 'badges') return query([{ id: 'a', name: 'A', description: 'd', icon: 'box' }], null)
      if (table === 'user_badges') return query(null, null, { message: 'permission denied', code: '42501' })
      return query([], null)
    })
    await expect(badges.sync()).rejects.toBeTruthy()
    fromMock.mockImplementation((table: string) => (table === 'badges' || table === 'user_badges' ? query(null, null) : query([], null)))
    await badges.sync()
    expect(badges.badges).toEqual([])
  })

  it('synchronise les badges', async () => {
    rpcMock.mockResolvedValue({ error: null })
    const badges = useBadgeStore()
    await badges.sync()
    expect(badges.badges[0]?.earnedAt).toBe('2026-01-03')
    badges.clearError()
    rpcMock.mockResolvedValue({ error: { message: 'network' } })
    await expect(badges.sync()).rejects.toBeTruthy()
    rpcMock.mockResolvedValue({ error: null })
    installBackend({ message: 'permission denied', status: 403 })
    await expect(badges.sync()).rejects.toBeTruthy()
  })
})
