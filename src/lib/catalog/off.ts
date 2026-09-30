import { OFF_USER_AGENT } from '@/lib/catalog/convert'

export interface OffClientOptions {
  fetchImpl?: typeof fetch
  cache?: Map<string, string>
  sleep?: (ms: number) => Promise<void>
  minIntervalMs?: number
  now?: () => number
}

export interface OffClient {
  getJson(url: string): Promise<{ ok: true; body: unknown } | { ok: false; reason: string }>
  getBytes(url: string): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string }>
}

export function createOffClient(options: OffClientOptions = {}): OffClient {
  const fetchImpl = options.fetchImpl ?? fetch
  const cache = options.cache ?? new Map<string, string>()
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const minIntervalMs = options.minIntervalMs ?? 1000
  const now = options.now ?? Date.now
  let lastCall = 0

  async function waitTurn() {
    const elapsed = now() - lastCall
    if (minIntervalMs > 0 && elapsed < minIntervalMs) await sleep(minIntervalMs - elapsed)
    lastCall = now()
  }

  async function request(url: string): Promise<{ ok: true; response: Response } | { ok: false; reason: string }> {
    await waitTurn()
    try {
      const response = await fetchImpl(url, { headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' } })
      if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` }
      return { ok: true, response }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'réseau indisponible'
      return { ok: false, reason: message || 'réseau indisponible' }
    }
  }

  return {
    async getJson(url: string) {
      const cached = cache.get(url)
      if (cached != null) {
        try {
          return { ok: true, body: JSON.parse(cached) as unknown }
        } catch {
          cache.delete(url)
        }
      }
      const result = await request(url)
      if (!result.ok) return result
      try {
        const text = await result.response.text()
        const body = JSON.parse(text) as unknown
        cache.set(url, text)
        return { ok: true, body }
      } catch {
        return { ok: false, reason: 'JSON invalide' }
      }
    },
    async getBytes(url: string) {
      const result = await request(url)
      if (!result.ok) return result
      try {
        const bytes = new Uint8Array(await result.response.arrayBuffer())
        if (bytes.byteLength === 0) return { ok: false, reason: 'image vide' }
        return { ok: true, bytes }
      } catch {
        return { ok: false, reason: 'image illisible' }
      }
    },
  }
}
