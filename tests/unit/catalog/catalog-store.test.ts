import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'

const { rpcMock, fromMock, uploadMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  uploadMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    rpc: rpcMock,
    from: fromMock,
    storage: { from: () => ({ upload: uploadMock }) },
  }),
}))

const row = {
  id: 'p1',
  name: 'Gel',
  brand: 'Baouw',
  product_type: 'gel',
  flavor: null,
  carbs_g: 22,
  sodium_mg: 10,
  caffeine_mg: null,
  volume_ml: null,
  scope: 'catalog',
  owner_id: null,
  barcode: '12345678',
  verified: false,
  source: 'off',
  data_quality: 'incomplete',
  carbs_known: true,
}

function query(data: unknown, error: { message: string } | null = null) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  for (const method of ['select', 'update', 'eq']) builder[method] = vi.fn(chain)
  builder.maybeSingle = vi.fn(async () => ({ data, error }))
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve)
  return builder
}

describe('store catalogue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.user = { id: 'user-1' } as never
    auth.profile = { id: 'user-1', pseudo: 'Ada', weightKg: null, primarySport: null, toleranceGPerHour: 60, preferredFlavors: [], role: 'admin', createdAt: '', updatedAt: '' }
    rpcMock.mockReset()
    fromMock.mockReset()
    uploadMock.mockReset()
    uploadMock.mockResolvedValue({ error: null })
    fromMock.mockImplementation(() => query(row))
  })

  it('cherche, ouvre, duplique et modère', async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'search_products') return { data: { total: 1, items: [row, null] }, error: null }
      if (fn === 'fork_catalog_product') return { data: 'copy-1', error: null }
      if (fn === 'admin_list_forks') return { data: [row], error: null }
      return { data: null, error: null }
    })
    const catalog = useCatalogStore()
    await catalog.search({ text: 'gel', page: 1, pageSize: 24 })
    expect(catalog.total).toBe(1)
    expect(catalog.items[0]?.name).toBe('Gel')
    expect(await catalog.open('p1')).toMatchObject({ id: 'p1' })
    fromMock.mockImplementationOnce(() => query(null))
    expect(await catalog.open('absent')).toBeNull()
    expect(await catalog.fork('p1')).toBe('copy-1')
    await catalog.loadForks()
    expect(catalog.forks).toHaveLength(1)
    rpcMock.mockResolvedValueOnce({ data: null, error: null })
    await catalog.loadForks()
    expect(catalog.forks).toEqual([])
    await catalog.promote('p1')
    await catalog.merge('a', 'b')
    await catalog.markVerified('p1')
    await catalog.savePurchase('p1', { buyUrl: 'https://exemple.fr', indicativePriceEur: 2 })
    catalog.clearError()
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    expect(await catalog.uploadImage('p1', png, 'users')).toContain('users/user-1')
    expect(await catalog.uploadImage('p1', png, 'users', 'autre')).toContain('users/autre')
    expect(await catalog.uploadImage('p1', png, 'catalog')).toContain('catalog/')
  })

  it('remonte les erreurs et refuse un fichier invalide', async () => {
    const catalog = useCatalogStore()
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(catalog.search({})).rejects.toBeTruthy()
    expect(catalog.error).toBeTruthy()
    fromMock.mockImplementation(() => query(null, { message: 'introuvable' }))
    await expect(catalog.open('p1')).rejects.toBeTruthy()
    await expect(catalog.fork('p1')).rejects.toBeTruthy()
    await expect(catalog.loadForks()).rejects.toBeTruthy()
    await expect(catalog.promote('p1')).rejects.toBeTruthy()
    await expect(catalog.merge('a', 'b')).rejects.toBeTruthy()
    await expect(catalog.markVerified('p1', false)).rejects.toBeTruthy()
    await expect(catalog.savePurchase('p1', { buyUrl: null, indicativePriceEur: null })).rejects.toBeTruthy()
    await expect(catalog.uploadImage('p1', new Uint8Array([1, 2, 3]), 'users')).rejects.toBeTruthy()
    const auth = useAuthStore()
    auth.user = null
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    await expect(catalog.uploadImage('p1', png, 'users')).rejects.toBeTruthy()
    uploadMock.mockResolvedValueOnce({ error: { message: 'storage' } })
    auth.user = { id: 'user-1' } as never
    await expect(catalog.uploadImage('p1', png, 'catalog')).rejects.toBeTruthy()
    uploadMock.mockResolvedValueOnce({ error: null })
    fromMock.mockImplementation(() => query(row, { message: 'update' }))
    await expect(catalog.uploadImage('p1', png, 'catalog')).rejects.toBeTruthy()
    rpcMock.mockResolvedValue({ data: [], error: null })
    await catalog.search({})
    expect(catalog.total).toBe(0)
  })
})
