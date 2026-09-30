import { createRouter, createWebHistory } from 'vue-router'
import { redirectFor } from '@/router/guards'
import { useAuthStore } from '@/stores/auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/connexion', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
    { path: '/inscription', name: 'signup', component: () => import('@/views/SignupView.vue'), meta: { guest: true } },
    {
      path: '/mot-de-passe-oublie',
      name: 'forgot',
      component: () => import('@/views/ForgotPasswordView.vue'),
      meta: { guest: true },
    },
    { path: '/auth/confirm', name: 'confirm', component: () => import('@/views/ConfirmView.vue') },
    { path: '/auth/reinitialiser', name: 'reset', component: () => import('@/views/ResetPasswordView.vue') },
    {
      path: '/app',
      component: () => import('@/views/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'box', name: 'box', component: () => import('@/views/BoxView.vue') },
        { path: 'produits/nouveau', name: 'product-new', component: () => import('@/views/ProductFormView.vue') },
        { path: 'produits/:id', name: 'product-edit', component: () => import('@/views/ProductFormView.vue') },
        { path: 'sortie', name: 'outing', component: () => import('@/views/OutingView.vue') },
        { path: 'plans', name: 'plans', component: () => import('@/views/PlansListView.vue') },
        { path: 'plans/:id', name: 'plan', component: () => import('@/views/PlanView.vue') },
        { path: 'plans/:id/jour-j', name: 'race-day', component: () => import('@/views/RaceDayView.vue') },
        { path: 'plans/:id/debrief', name: 'debrief', component: () => import('@/views/DebriefView.vue') },
        { path: 'badges', name: 'badges', component: () => import('@/views/BadgesView.vue') },
        { path: 'compte', name: 'account', component: () => import('@/views/AccountView.vue') },
        {
          path: 'admin/catalogue',
          name: 'admin-catalog',
          component: () => import('@/views/AdminCatalogView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/comptes',
          name: 'admin-accounts',
          component: () => import('@/views/AdminAccountsView.vue'),
          meta: { requiresAdmin: true },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.init()
  return redirectFor(to, {
    user: auth.isAuthenticated,
    role: auth.profile?.role ?? null,
  })
})
