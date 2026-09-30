import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getSupabase } from '@/lib/supabase'
import { mergeBox, type BoxEntry, type BoxItem } from '@/lib/box'
import { mapProduct, type Product } from '@/lib/mappers'
import { toUserMessage } from '@/lib/errors'
import type { ProductInput } from '@/schemas/product'
import { useAuthStore } from '@/stores/auth'

function productFields(input: ProductInput) {
  return {
    name: input.name,
    brand: input.brand,
    product_type: input.productType,
    flavor: input.flavor,
    carbs_g: input.carbsG,
    sodium_mg: input.sodiumMg,
    caffeine_mg: input.caffeineMg,
    volume_ml: input.volumeMl,
  }
}

export const useBoxStore = defineStore('box', () => {
  const products = ref<Product[]>([])
  const entries = ref<BoxEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const catalog = computed(() => products.value.filter((product) => product.scope === 'catalog'))
  const customProducts = computed(() => products.value.filter((product) => product.scope === 'custom'))

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

  async function fetchAll() {
    const supabase = getSupabase()
    const [productResult, boxResult, favoriteResult] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('box_items').select('*'),
      supabase.from('favorites').select('product_id'),
    ])
    if (productResult.error) throw productResult.error
    if (boxResult.error) throw boxResult.error
    if (favoriteResult.error) throw favoriteResult.error
    products.value = (productResult.data ?? []).map(mapProduct)
    const items: BoxItem[] = (boxResult.data ?? []).map((row) => ({
      productId: row.product_id,
      quantity: row.quantity,
      excluded: row.excluded,
    }))
    const favoriteIds = (favoriteResult.data ?? []).map((row) => row.product_id)
    entries.value = mergeBox(products.value, items, favoriteIds)
  }

  function load() {
    return run(fetchAll)
  }

  function addProduct(productId: string, quantity = 1) {
    return run(async () => {
      const auth = useAuthStore()
      if (!auth.user) throw { status: 401, message: 'session expired' }
      const { error: insertError } = await getSupabase().from('box_items').upsert({
        user_id: auth.user.id,
        product_id: productId,
        quantity,
        excluded: false,
      })
      if (insertError) throw insertError
      await fetchAll()
    })
  }

  function updateItem(productId: string, patch: { quantity?: number; excluded?: boolean }) {
    return run(async () => {
      const auth = useAuthStore()
      if (!auth.user) throw { status: 401, message: 'session expired' }
      const { error: updateError } = await getSupabase()
        .from('box_items')
        .update({
          ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
          ...(patch.excluded !== undefined ? { excluded: patch.excluded } : {}),
        })
        .eq('user_id', auth.user.id)
        .eq('product_id', productId)
      if (updateError) throw updateError
      await fetchAll()
    })
  }

  function removeItem(productId: string) {
    return run(async () => {
      const auth = useAuthStore()
      if (!auth.user) throw { status: 401, message: 'session expired' }
      const { error: deleteError } = await getSupabase()
        .from('box_items')
        .delete()
        .eq('user_id', auth.user.id)
        .eq('product_id', productId)
      if (deleteError) throw deleteError
      await fetchAll()
    })
  }

  function toggleFavorite(productId: string, favorite: boolean) {
    return run(async () => {
      const auth = useAuthStore()
      if (!auth.user) throw { status: 401, message: 'session expired' }
      const supabase = getSupabase()
      const result = favorite
        ? await supabase.from('favorites').insert({ user_id: auth.user.id, product_id: productId })
        : await supabase.from('favorites').delete().eq('user_id', auth.user.id).eq('product_id', productId)
      if (result.error) throw result.error
      await fetchAll()
    })
  }

  function saveProduct(input: ProductInput, scope: 'catalog' | 'custom', productId?: string) {
    return run(async () => {
      const auth = useAuthStore()
      if (!auth.user) throw { status: 401, message: 'session expired' }
      const ownerId = scope === 'custom' ? auth.user.id : null
      const fields = productFields(input)
      const supabase = getSupabase()
      const result = productId
        ? await supabase.from('products').update(fields).eq('id', productId).select('*').single()
        : await supabase
            .from('products')
            .insert({ ...fields, scope, owner_id: ownerId })
            .select('*')
            .single()
      if (result.error) throw result.error
      await fetchAll()
      return mapProduct(result.data)
    })
  }

  function deleteProduct(productId: string) {
    return run(async () => {
      const { error: deleteError } = await getSupabase().from('products').delete().eq('id', productId)
      if (deleteError) throw deleteError
      await fetchAll()
    })
  }

  function copyProduct(productId: string) {
    return run(async () => {
      const source = products.value.find((product) => product.id === productId)
      if (!source) throw { message: 'Produit introuvable.' }
      return saveProduct(
        {
          name: `${source.name} (copie)`.slice(0, 120),
          brand: source.brand,
          productType: source.type,
          flavor: source.flavor,
          carbsG: source.carbsG,
          sodiumMg: source.sodiumMg,
          caffeineMg: source.caffeineMg,
          volumeMl: source.volumeMl,
        },
        'custom',
      )
    })
  }

  return {
    products,
    entries,
    catalog,
    customProducts,
    loading,
    error,
    clearError,
    load,
    addProduct,
    updateItem,
    removeItem,
    toggleFavorite,
    saveProduct,
    deleteProduct,
    copyProduct,
  }
})
