import { describe, expect, it } from 'vitest'
import { redirectFor } from '@/router/guards'

describe('gardes de navigation', () => {
  const secret = { meta: { requiresAuth: true }, fullPath: '/app/box' }
  const guest = { meta: { guest: true }, fullPath: '/connexion' }
  const admin = { meta: { requiresAdmin: true, requiresAuth: true }, fullPath: '/app/admin/catalogue' }
  const home = { meta: {}, fullPath: '/' }

  it('renvoie vers la connexion, le tableau ou laisse passer', () => {
    expect(redirectFor(secret, { user: false, role: null })).toEqual({ name: 'login', query: { redirect: '/app/box' } })
    expect(redirectFor(secret, { user: true, role: 'user' })).toBe(true)
    expect(redirectFor(guest, { user: true, role: 'user' })).toEqual({ name: 'dashboard' })
    expect(redirectFor(guest, { user: false, role: null })).toBe(true)
    expect(redirectFor(admin, { user: true, role: 'user' })).toEqual({ name: 'dashboard' })
    expect(redirectFor(admin, { user: true, role: 'admin' })).toBe(true)
    expect(redirectFor(admin, { user: false, role: null })).toEqual({ name: 'login', query: { redirect: '/app/admin/catalogue' } })
    expect(redirectFor(home, { user: false, role: null })).toBe(true)
  })
})
