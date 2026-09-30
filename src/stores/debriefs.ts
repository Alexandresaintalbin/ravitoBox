import { ref } from 'vue'
import { defineStore } from 'pinia'
import { proposeAdjustments, type Adjustment, type DebriefSnapshot } from '@/engine'
import { getSupabase } from '@/lib/supabase'
import { toUserMessage } from '@/lib/errors'
import type { Json } from '@/types/database'
import type { DebriefInput } from '@/schemas/debrief'
import { useAuthStore } from '@/stores/auth'
import { usePlansStore, type SavedPlan } from '@/stores/plans'

export interface Debrief {
  id: string
  planId: string
  energy: number
  stomach: number
  thirst: number
  notes: string
  consumed: DebriefInput['consumed']
  createdAt: string
}

function mapDebrief(row: {
  id: string
  plan_id: string
  energy: number
  stomach: number
  thirst: number
  notes: string | null
  consumed: Json
  created_at: string
}): Debrief {
  return {
    id: row.id,
    planId: row.plan_id,
    energy: row.energy,
    stomach: row.stomach,
    thirst: row.thirst,
    notes: row.notes ?? '',
    consumed: (row.consumed ?? []) as Debrief['consumed'],
    createdAt: row.created_at,
  }
}

export function snapshotsFrom(debriefs: Debrief[], plans: SavedPlan[]): DebriefSnapshot[] {
  return debriefs.map((debrief) => {
    const plan = plans.find((item) => item.id === debrief.planId)
    const minutes = plan?.parameters.durationMinutes ?? 0
    const consumedCarbs = debrief.consumed.reduce((sum, item) => {
      const intakes = plan?.generatedPlan?.intakes ?? []
      const intake = intakes.find((entry) => entry.productId === item.productId)
      return sum + (intake?.carbsG ?? 0) * item.quantity
    }, 0)
    const hours = minutes > 0 ? minutes / 60 : 0
    return {
      carbsGPerHourConsumed: hours > 0 ? consumedCarbs / hours : 0,
      stomach: debrief.stomach,
      energy: debrief.energy,
      thirst: debrief.thirst,
      durationMinutes: minutes,
    }
  })
}

export function adjustmentsFor(plan: SavedPlan, debrief: DebriefInput, tolerance: number): Adjustment[] {
  return proposeAdjustments({
    stomach: debrief.stomach,
    energy: debrief.energy,
    thirst: debrief.thirst,
    carbsGPerHour: plan.targets.carbsGPerHour,
    fluidMlPerHour: plan.targets.fluidMlPerHour,
    sodiumMgPerHour: plan.targets.sodiumMgPerHour,
    toleranceGPerHour: tolerance,
  })
}

export const useDebriefStore = defineStore('debriefs', () => {
  const items = ref<Debrief[]>([])
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

  function list(planId?: string) {
    return run(async () => {
      let query = getSupabase().from('debriefs').select('*').order('created_at', { ascending: false })
      if (planId) query = query.eq('plan_id', planId)
      const { data, error: queryError } = await query
      if (queryError) throw queryError
      items.value = (data ?? []).map(mapDebrief)
    })
  }

  function create(planId: string, input: DebriefInput) {
    return run(async () => {
      const auth = useAuthStore()
      if (!auth.user) throw { status: 401, message: 'session expired' }
      const { data, error: insertError } = await getSupabase()
        .from('debriefs')
        .insert({
          plan_id: planId,
          user_id: auth.user.id,
          energy: input.energy,
          stomach: input.stomach,
          thirst: input.thirst,
          notes: input.notes || null,
          consumed: input.consumed as unknown as Json,
        })
        .select('*')
        .single()
      if (insertError) throw insertError
      const created = mapDebrief(data)
      items.value = [created, ...items.value]
      return created
    })
  }

  function historyForGut() {
    const plans = usePlansStore()
    return snapshotsFrom(items.value, plans.plans)
  }

  return { items, loading, error, clearError, list, create, historyForGut }
})
