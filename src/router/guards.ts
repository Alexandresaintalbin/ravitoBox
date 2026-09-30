import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

export interface GuardState {
  user: boolean
  role: 'user' | 'admin' | null
}

export function redirectFor(to: Pick<RouteLocationNormalized, 'meta' | 'fullPath'>, state: GuardState): true | RouteLocationRaw {
  if (to.meta.requiresAuth && !state.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guest && state.user) {
    return { name: 'dashboard' }
  }
  if (to.meta.requiresAdmin && state.role !== 'admin') {
    return { name: 'dashboard' }
  }
  return true
}
