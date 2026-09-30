import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import SignupView from '@/views/SignupView.vue'
import ForgotPasswordView from '@/views/ForgotPasswordView.vue'
import ConfirmView from '@/views/ConfirmView.vue'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import DashboardView from '@/views/DashboardView.vue'
import BoxView from '@/views/BoxView.vue'
import ProductFormView from '@/views/ProductFormView.vue'
import OutingView from '@/views/OutingView.vue'
import PlansListView from '@/views/PlansListView.vue'
import PlanView from '@/views/PlanView.vue'
import RaceDayView from '@/views/RaceDayView.vue'
import DebriefView from '@/views/DebriefView.vue'
import AccountView from '@/views/AccountView.vue'
import AdminCatalogView from '@/views/AdminCatalogView.vue'
import AdminAccountsView from '@/views/AdminAccountsView.vue'
import BadgesView from '@/views/BadgesView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import AppLayout from '@/views/AppLayout.vue'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: { message: 'Invalid login credentials' } }),
      signUp: vi.fn().mockResolvedValue({ data: { user: { identities: [{ id: 'i' }] }, session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'signup_policy') return { data: { mode: 'open', email_confirmation: true }, error: null }
      return { data: [], error: null }
    }),
    from: () => {
      const result = { data: [], error: null }
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      for (const method of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order']) builder[method] = vi.fn(chain)
      builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
      builder.single = vi.fn(async () => ({ data: null, error: { message: 'introuvable' } }))
      builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      return builder
    },
  }),
}))

function mountView(component: object) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/connexion', component: LoginView },
      { path: '/app', component: DashboardView },
      { path: '/app/plans/:id', component: PlanView },
      { path: '/app/box', component: BoxView },
      { path: '/mot-de-passe-oublie', component: ForgotPasswordView },
    ],
  })
  const auth = useAuthStore()
  auth.user = { id: 'user-1' } as never
  auth.profile = {
    id: 'user-1',
    pseudo: 'Ada',
    weightKg: 60,
    primarySport: 'course',
    toleranceGPerHour: 60,
    preferredFlavors: ['citron'],
    role: 'admin',
    createdAt: '',
    updatedAt: '',
  }
  auth.ready = true
  return mount(component, { global: { plugins: [pinia, router] } })
}

describe('vues', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('affiche l’accueil, la connexion et l’inscription', async () => {
    const home = mountView(HomeView)
    expect(home.text()).toContain('ravitoBox')
    await home.get('button.menu-toggle').trigger('click')
    const login = mountView(LoginView)
    await login.get('form').trigger('submit')
    expect(login.text()).toContain('requis')
    await login.get('input[type="email"]').setValue('ada@exemple.fr')
    await login.get('input[type="password"]').setValue('secret123')
    await login.get('form').trigger('submit')
    await flushPromises()
    const signup = mountView(SignupView)
    await flushPromises()
    await signup.get('form').trigger('submit')
    await signup.get('input[autocomplete="nickname"]').setValue('Ada')
    await signup.get('input[type="email"]').setValue('ada@exemple.fr')
    await signup.get('input[type="password"]').setValue('secret123')
    await signup.get('form').trigger('submit')
    await flushPromises()
    expect(signup.text()).toContain('confirmation')
  })

  it('couvre les écrans de compte, de box et de plan', async () => {
    for (const view of [ForgotPasswordView, ConfirmView, ResetPasswordView, DashboardView, BoxView, ProductFormView, OutingView, PlansListView, PlanView, RaceDayView, DebriefView, AccountView, AdminCatalogView, AdminAccountsView, BadgesView, NotFoundView, AppLayout, AppHeader]) {
      const wrapper = mountView(view)
      await flushPromises()
      expect(wrapper.text().length).toBeGreaterThan(0)
    }
    const forgot = mountView(ForgotPasswordView)
    await forgot.get('form').trigger('submit')
    await forgot.get('input').setValue('ada@exemple.fr')
    await forgot.get('form').trigger('submit')
    await flushPromises()
    const reset = mountView(ResetPasswordView)
    await reset.get('form').trigger('submit')
    const box = mountView(BoxView)
    await flushPromises()
    await box.get('button').trigger('click')
    const outing = mountView(OutingView)
    await flushPromises()
    await outing.get('form').trigger('submit')
    const account = mountView(AccountView)
    await account.get('form').trigger('submit')
    await flushPromises()
  })
})
