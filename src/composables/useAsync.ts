import { ref } from 'vue'
import { toUserMessage } from '@/lib/errors'

export function useAsync<T>() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const data = ref<T | null>(null)

  async function run(action: () => Promise<T>): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const result = await action()
      data.value = result
      loading.value = false
      return result
    } catch (cause) {
      error.value = toUserMessage(cause)
      loading.value = false
      return null
    }
  }

  function reset() {
    loading.value = false
    error.value = null
    data.value = null
  }

  return { loading, error, data, run, reset }
}
