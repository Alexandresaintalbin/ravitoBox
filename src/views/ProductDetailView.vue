<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProductFacts from '@/components/ProductFacts.vue'
import { validateImageFile } from '@/lib/catalog/file'
import type { Product } from '@/lib/mappers'
import { useAuthStore } from '@/stores/auth'
import { useBoxStore } from '@/stores/box'
import { useCatalogStore } from '@/stores/catalog'

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const box = useBoxStore()
const auth = useAuthStore()
const product = ref<Product | null>(null)
const localError = ref('')
const buyUrl = ref('')
const price = ref('')

onMounted(async () => {
  const found = await catalog.open(String(route.params.id)).catch(() => null)
  product.value = found
  buyUrl.value = found?.buyUrl ?? ''
  price.value = found?.indicativePriceEur == null ? '' : String(found.indicativePriceEur)
})

async function add() {
  if (!product.value) return
  await box.addProduct(product.value.id).catch(() => undefined)
}

async function correct() {
  if (!product.value) return
  const id = await catalog.fork(product.value.id).catch(() => null)
  if (id) await router.push(`/app/produits/${id}`)
}

async function onPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !product.value) return
  const bytes = typeof file.arrayBuffer === 'function'
    ? new Uint8Array(await file.arrayBuffer())
    : new Uint8Array()
  const checked = validateImageFile(bytes, file.size)
  if (!checked.ok) {
    localError.value = checked.reason
    return
  }
  const folder = product.value.scope === 'catalog' && auth.isAdmin ? 'catalog' : 'users'
  await catalog.uploadImage(product.value.id, bytes, folder, auth.user?.id).catch(() => undefined)
  product.value = await catalog.open(product.value.id).catch(() => product.value)
}

async function saveBuy() {
  if (!product.value) return
  const parsed = price.value.trim() === '' ? null : Number(price.value)
  if (parsed != null && !Number.isFinite(parsed)) {
    localError.value = 'Prix invalide.'
    return
  }
  if (buyUrl.value && !/^https?:\/\//i.test(buyUrl.value)) {
    localError.value = 'Le lien doit commencer par http:// ou https://'
    return
  }
  localError.value = ''
  await catalog.savePurchase(product.value.id, { buyUrl: buyUrl.value || null, indicativePriceEur: parsed }).catch(() => undefined)
}
</script>

<template>
  <section class="stack wizard">
    <AppSpinner v-if="catalog.loading && !product" />
    <AppAlert v-if="localError || catalog.error" :message="localError || catalog.error || ''" />
    <EmptyState v-if="!catalog.loading && !product" title="Produit introuvable" text="Il a peut-être été retiré du catalogue." />
    <template v-else-if="product">
      <ProductFacts :product="product" />
      <div class="row">
        <button class="button primary" type="button" @click="add">Ajouter à ma Box</button>
        <button v-if="product.scope === 'catalog'" class="button ghost" type="button" @click="correct">Signaler une erreur / créer ma version corrigée</button>
      </div>
      <form class="card stack" @submit.prevent="saveBuy">
        <h2>Où l’acheter</h2>
        <p class="muted">Lien et prix indicatif saisis à la main. Aucun prix n’est récupéré automatiquement.</p>
        <label>Lien <input v-model="buyUrl" type="url" placeholder="https://" /></label>
        <label>Prix indicatif (€) <input v-model="price" inputmode="decimal" /></label>
        <button class="button ghost" type="submit">Enregistrer</button>
      </form>
      <label class="card">Photo
        <input type="file" accept="image/jpeg,image/png,image/webp" @change="onPhoto" />
      </label>
    </template>
  </section>
</template>
