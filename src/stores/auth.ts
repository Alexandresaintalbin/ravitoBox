import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { toUserMessage } from '@/lib/errors'
import { parseSignupPolicy } from '@/stores/accounts'
import { mapProfile, profileToUpdate, type Profile } from '@/lib/mappers'
import type { EmailChangeInput, LoginInput, PasswordPairInput, SignupInput } from '@/schemas/auth'
import type { ProfileInput } from '@/schemas/profile'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)
  const ready = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let started = false

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => profile.value?.role === 'admin')

  function clearError() {
    error.value = null
  }

  async function loadProfile() {
    if (!user.value) {
      profile.value = null
      return
    }
    const { data, error: queryError } = await getSupabase()
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .maybeSingle()
    if (queryError) throw queryError
    profile.value = data ? mapProfile(data) : null
  }

  async function init() {
    if (started) return
    started = true
    try {
      const supabase = getSupabase()
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) error.value = toUserMessage(sessionError)
      user.value = data.session?.user ?? null
      if (user.value) await loadProfile()
      supabase.auth.onAuthStateChange((_event, session) => {
        user.value = session?.user ?? null
        if (!session) profile.value = null
        else void loadProfile().catch((cause: unknown) => {
          error.value = toUserMessage(cause)
        })
      })
    } catch (cause) {
      error.value = toUserMessage(cause)
    } finally {
      ready.value = true
    }
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

  function loadSignupPolicy() {
    return run(async () => {
      const { data, error: queryError } = await getSupabase().rpc('signup_policy')
      if (queryError) throw queryError
      return parseSignupPolicy(data)
    })
  }

  function signUp(input: SignupInput) {
    return run(async () => {
      const { data, error: signUpError } = await getSupabase().auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            pseudo: input.pseudo,
            ...(input.invitationCode ? { invitation_code: input.invitationCode } : {}),
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })
      if (signUpError) throw signUpError
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw { message: 'User already registered', code: '23505' }
      }
      return { needsConfirmation: !data.session }
    })
  }

  function signIn(input: LoginInput) {
    return run(async () => {
      const { data, error: signInError } = await getSupabase().auth.signInWithPassword({
        email: input.email,
        password: input.password,
      })
      if (signInError) throw signInError
      user.value = data.user
      await loadProfile()
    })
  }

  function signOut() {
    return run(async () => {
      const { error: signOutError } = await getSupabase().auth.signOut()
      if (signOutError) throw signOutError
      user.value = null
      profile.value = null
    })
  }

  function requestPasswordReset(email: string) {
    return run(async () => {
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reinitialiser`,
      })
      if (resetError) throw resetError
    })
  }

  function updatePassword(input: PasswordPairInput) {
    return run(async () => {
      const { error: updateError } = await getSupabase().auth.updateUser({ password: input.password })
      if (updateError) throw updateError
    })
  }

  function updateEmail(input: EmailChangeInput) {
    return run(async () => {
      const { error: updateError } = await getSupabase().auth.updateUser(
        { email: input.email },
        { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      )
      if (updateError) throw updateError
    })
  }

  function updateProfile(input: ProfileInput) {
    return run(async () => {
      if (!user.value) throw { message: 'session expired', status: 401 }
      const { data, error: updateError } = await getSupabase()
        .from('profiles')
        .update(profileToUpdate(input))
        .eq('id', user.value.id)
        .select('*')
        .single()
      if (updateError) throw updateError
      profile.value = mapProfile(data)
    })
  }

  function deleteAccount() {
    return run(async () => {
      const { error: rpcError } = await getSupabase().rpc('delete_own_account')
      if (rpcError) throw rpcError
      user.value = null
      profile.value = null
      const { error: signOutError } = await getSupabase().auth.signOut()
      if (signOutError) throw signOutError
    })
  }

  function exportData() {
    return run(async () => {
      const supabase = getSupabase()
      const [profileResult, productsResult, boxResult, favoritesResult, plansResult, debriefsResult, badgesResult] =
        await Promise.all([
          supabase.from('profiles').select('*').maybeSingle(),
          supabase.from('products').select('*').eq('scope', 'custom'),
          supabase.from('box_items').select('*'),
          supabase.from('favorites').select('*'),
          supabase.from('plans').select('*'),
          supabase.from('debriefs').select('*'),
          supabase.from('user_badges').select('*'),
        ])
      const failure = [profileResult, productsResult, boxResult, favoritesResult, plansResult, debriefsResult, badgesResult].find(
        (result) => result.error,
      )
      if (failure?.error) throw failure.error
      return {
        exportedAt: new Date().toISOString(),
        profile: profileResult.data,
        customProducts: productsResult.data ?? [],
        box: boxResult.data ?? [],
        favorites: favoritesResult.data ?? [],
        plans: plansResult.data ?? [],
        debriefs: debriefsResult.data ?? [],
        badges: badgesResult.data ?? [],
      }
    })
  }

  return {
    user,
    profile,
    ready,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    clearError,
    init,
    loadProfile,
    loadSignupPolicy,
    signUp,
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
    updateEmail,
    updateProfile,
    deleteAccount,
    exportData,
  }
})
