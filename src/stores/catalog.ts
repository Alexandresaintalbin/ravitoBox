import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getSupabase } from '@/lib/supabase'
import { toUserMessage } from '@/lib/errors'
import { mapProduct, type MappableProduct, type Product } from '@/lib/mappers'
import { parseSearchPayload, toSearchRpc, type CatalogQuery } from '@/lib/catalog/search'
import { validateImageFile } from '@/lib/catalog/file'
import { useAuthStore } from '@/stores/auth'

export const useCatalogStore = defineStore('catalog', () => {
  const items = ref<Product[]>([])
  const total = ref(0)
  const forks = ref<Product[]>([])
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

  function search(query: Partial<CatalogQuery>, scope: 'catalog' | 'custom' | 'all' = 'catalog', review = false) {
    return run(async () => {
      const { data, error: rpcError } = await getSupabase().rpc('search_products', toSearchRpc(query, scope, review))
      if (rpcError) throw rpcError
      const parsed = parseSearchPayload(data)
      items.value = parsed.items.map((row) => mapProduct(row as unknown as MappableProduct))
      total.value = parsed.total
    })
  }

  function open(id: string) {
    return run(async () => {
      const { data, error: queryError } = await getSupabase().from('products').select('*').eq('id', id).maybeSingle()
      if (queryError) throw queryError
      if (!data) return null
      return mapProduct(data)
    })
  }

  function fork(sourceId: string) {
    return run(async () => {
      const { data, error: rpcError } = await getSupabase().rpc('fork_catalog_product', { source_id: sourceId })
      if (rpcError) throw rpcError
      return data
    })
  }

  function loadForks() {
    return run(async () => {
      const { data, error: rpcError } = await getSupabase().rpc('admin_list_forks')
      if (rpcError) throw rpcError
      forks.value = (data ?? []).map(mapProduct)
    })
  }

  function promote(productId: string) {
    return run(async () => {
      const { error: rpcError } = await getSupabase().rpc('admin_promote_product', { product_id: productId })
      if (rpcError) throw rpcError
    })
  }

  function merge(keepId: string, dropId: string) {
    return run(async () => {
      const { error: rpcError } = await getSupabase().rpc('admin_merge_products', { keep_id: keepId, drop_id: dropId })
      if (rpcError) throw rpcError
    })
  }

  function markVerified(productId: string, verified = true) {
    return run(async () => {
      const { error: updateError } = await getSupabase().from('products').update({ verified }).eq('id', productId)
      if (updateError) throw updateError
    })
  }

  function savePurchase(productId: string, input: { buyUrl: string | null; indicativePriceEur: number | null }) {
    return run(async () => {
      const { error: updateError } = await getSupabase()
        .from('products')
        .update({ buy_url: input.buyUrl, indicative_price_eur: input.indicativePriceEur })
        .eq('id', productId)
      if (updateError) throw updateError
    })
  }

  function uploadImage(productId: string, bytes: Uint8Array, folder: 'users' | 'catalog', ownerId?: string) {
    return run(async () => {
      const auth = useAuthStore()
      const checked = validateImageFile(bytes)
      if (!checked.ok) throw { message: checked.reason }
      const key = folder === 'catalog' ? `catalog/${productId}.webp` : `users/${ownerId ?? auth.user?.id}/${productId}.webp`
      if (folder === 'users' && !auth.user) throw { status: 401, message: 'session expired' }
      const { error: uploadError } = await getSupabase()
        .storage.from('product-images')
        .upload(key, bytes, { upsert: true, contentType: checked.mime })
      if (uploadError) throw uploadError
      const { error: updateError } = await getSupabase()
        .from('products')
        .update({ image_path: key, image_credit: folder === 'catalog' ? 'Catalogue ravitoBox' : 'Photo de l’athlète' })
        .eq('id', productId)
      if (updateError) throw updateError
      return key
    })
  }

  return {
    items, total, forks, loading, error, clearError,
    search, open, fork, loadForks, promote, merge, markVerified, savePurchase, uploadImage,
  }
})
