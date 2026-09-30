import { createClient } from '@supabase/supabase-js'
import { afterAll, describe, expect, it } from 'vitest'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const enabled = Boolean(url && anonKey && serviceKey)

describe.skipIf(!enabled)('RLS', () => {
  const password = 'secret123'
  const stamp = Date.now()
  const emailA = `alice.${stamp}@exemple.fr`
  const emailB = `bruno.${stamp}@exemple.fr`
  let idA = ''
  let idB = ''

  async function admin(path: string, init: RequestInit = {}) {
    const response = await fetch(`${url}/auth/v1${path}`, {
      ...init,
      headers: {
        apikey: serviceKey as string,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
    const body = await response.text()
    if (!response.ok) throw new Error(body)
    return body ? JSON.parse(body) : null
  }

  afterAll(async () => {
    if (!enabled) return
    for (const id of [idA, idB]) {
      if (id) await admin(`/admin/users/${id}`, { method: 'DELETE' }).catch(() => undefined)
    }
  })

  it('isole les données de deux comptes et protège le catalogue', async () => {
    const userA = await admin('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: emailA, password, email_confirm: true, user_metadata: { pseudo: 'Alice' } }),
    })
    const userB = await admin('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: emailB, password, email_confirm: true, user_metadata: { pseudo: 'Bruno' } }),
    })
    idA = userA.id
    idB = userB.id

    const clientA = createClient(url as string, anonKey as string, { auth: { persistSession: false } })
    const clientB = createClient(url as string, anonKey as string, { auth: { persistSession: false } })
    expect((await clientA.auth.signInWithPassword({ email: emailA, password })).error).toBeNull()
    expect((await clientB.auth.signInWithPassword({ email: emailB, password })).error).toBeNull()

    const catalog = await clientB.from('products').select('id').eq('scope', 'catalog')
    expect(catalog.error).toBeNull()
    expect((catalog.data ?? []).length).toBeGreaterThan(10)

    const created = await clientA
      .from('products')
      .insert({
        name: 'Gel privé',
        product_type: 'gel',
        carbs_g: 20,
        sodium_mg: 10,
        caffeine_mg: 0,
        scope: 'custom',
        owner_id: idA,
      })
      .select('id')
      .single()
    expect(created.error).toBeNull()

    const plan = await clientA
      .from('plans')
      .insert({
        user_id: idA,
        title: 'Secret',
        sport: 'course',
        session_type: 'entrainement',
        parameters: { durationMinutes: 90 },
        targets: { carbsGPerHour: 45 },
        generated_plan: { intakes: [] },
      })
      .select('id')
      .single()
    expect(plan.error).toBeNull()

    const stolenProduct = await clientB.from('products').select('id').eq('id', created.data?.id ?? '')
    const stolenPlan = await clientB.from('plans').select('id').eq('id', plan.data?.id ?? '')
    expect(stolenProduct.data ?? []).toEqual([])
    expect(stolenPlan.data ?? []).toEqual([])

    const forbidden = await clientB.from('products').insert({
      name: 'Intrusion',
      product_type: 'eau',
      scope: 'catalog',
      owner_id: null,
    })
    expect(forbidden.error).toBeTruthy()

    const roleChange = await clientA.from('profiles').update({ role: 'admin' }).eq('id', idA).select('role').single()
    expect(roleChange.error).toBeTruthy()

    const service = createClient(url as string, serviceKey as string, { auth: { persistSession: false } })
    const missing = await service.rpc('tables_without_rls')
    expect(missing.error).toBeNull()
    expect(missing.data ?? []).toEqual([])
  })
})
