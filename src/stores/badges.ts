import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getSupabase } from '@/lib/supabase'
import { toUserMessage } from '@/lib/errors'

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earnedAt: string | null
}

export const useBadgeStore = defineStore('badges', () => {
  const badges = ref<Badge[]>([])
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

  function sync() {
    return run(async () => {
      const supabase = getSupabase()
      const { error: rpcError } = await supabase.rpc('sync_my_badges')
      if (rpcError) throw rpcError
      const [catalogResult, earnedResult] = await Promise.all([
        supabase.from('badges').select('*').order('name'),
        supabase.from('user_badges').select('*'),
      ])
      if (catalogResult.error) throw catalogResult.error
      if (earnedResult.error) throw earnedResult.error
      const earned = new Map((earnedResult.data ?? []).map((row) => [row.badge_id, row.earned_at]))
      badges.value = (catalogResult.data ?? []).map((badge) => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        earnedAt: earned.get(badge.id) ?? null,
      }))
    })
  }

  return { badges, loading, error, clearError, sync }
})
