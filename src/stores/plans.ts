import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { GeneratedPlan, HourlyTargets } from '@/engine'
import { getSupabase } from '@/lib/supabase'
import { toUserMessage } from '@/lib/errors'
import type { Json } from '@/types/database'
import type { OutingFormInput } from '@/schemas/outing'
import { useAuthStore } from '@/stores/auth'

export interface SavedPlan {
  id: string
  title: string
  sport: OutingFormInput['sport']
  sessionType: OutingFormInput['sessionType']
  parameters: OutingFormInput & { durationMinutes: number }
  targets: HourlyTargets
  generatedPlan: GeneratedPlan
  createdAt: string
  updatedAt: string
}

function asPlan(row: {
  id: string
  title: string
  sport: SavedPlan['sport']
  session_type: SavedPlan['sessionType']
  parameters: Json
  targets: Json
  generated_plan: Json
  created_at: string
  updated_at: string
}): SavedPlan {
  return {
    id: row.id,
    title: row.title,
    sport: row.sport,
    sessionType: row.session_type,
    parameters: row.parameters as SavedPlan['parameters'],
    targets: row.targets as unknown as HourlyTargets,
    generatedPlan: row.generated_plan as unknown as GeneratedPlan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const usePlansStore = defineStore('plans', () => {
  const plans = ref<SavedPlan[]>([])
  const current = ref<SavedPlan | null>(null)
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

  function list() {
    return run(async () => {
      const { data, error: queryError } = await getSupabase()
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false })
      if (queryError) throw queryError
      plans.value = (data ?? []).map(asPlan)
    })
  }

  function open(id: string) {
    return run(async () => {
      const { data, error: queryError } = await getSupabase().from('plans').select('*').eq('id', id).maybeSingle()
      if (queryError) throw queryError
      current.value = data ? asPlan(data) : null
      if (!current.value) throw { message: 'Plan introuvable.' }
      return current.value
    })
  }

  function save(input: { form: OutingFormInput; durationMinutes: number; targets: HourlyTargets; plan: GeneratedPlan }) {
    return run(async () => {
      const auth = useAuthStore()
      if (!auth.user) throw { status: 401, message: 'session expired' }
      const { data, error: insertError } = await getSupabase()
        .from('plans')
        .insert({
          user_id: auth.user.id,
          title: input.form.title,
          sport: input.form.sport,
          session_type: input.form.sessionType,
          parameters: { ...input.form, durationMinutes: input.durationMinutes } as unknown as Json,
          targets: input.targets as unknown as Json,
          generated_plan: input.plan as unknown as Json,
        })
        .select('*')
        .single()
      if (insertError) throw insertError
      current.value = asPlan(data)
      return current.value
    })
  }

  function duplicate(id: string) {
    return run(async () => {
      const auth = useAuthStore()
      if (!auth.user) throw { status: 401, message: 'session expired' }
      const { data, error: queryError } = await getSupabase().from('plans').select('*').eq('id', id).single()
      if (queryError) throw queryError
      const copyTitle = `Copie de ${data.title}`.slice(0, 80)
      const { data: created, error: insertError } = await getSupabase()
        .from('plans')
        .insert({
          user_id: auth.user.id,
          title: copyTitle,
          sport: data.sport,
          session_type: data.session_type,
          parameters: data.parameters,
          targets: data.targets,
          generated_plan: data.generated_plan,
        })
        .select('*')
        .single()
      if (insertError) throw insertError
      return asPlan(created)
    })
  }

  function remove(id: string) {
    return run(async () => {
      const { error: deleteError } = await getSupabase().from('plans').delete().eq('id', id)
      if (deleteError) throw deleteError
      plans.value = plans.value.filter((plan) => plan.id !== id)
      if (current.value?.id === id) current.value = null
    })
  }

  return { plans, current, loading, error, clearError, list, open, save, duplicate, remove }
})
