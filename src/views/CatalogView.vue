<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppAlert from '@/components/AppAlert.vue'
import CatalogFilters from '@/components/CatalogFilters.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProductTile from '@/components/ProductTile.vue'
import SkeletonCards from '@/components/SkeletonCards.vue'
import Stepper from '@/components/Stepper.vue'
import { useBoxStore } from '@/stores/box'
import { useCatalogStore } from '@/stores/catalog'

const catalog = useCatalogStore()
const box = useBoxStore()
const page = ref(1)
const filters = ref({
  text: '', type: '', brand: '', flavor: '', carbsMin: '', carbsMax: '',
  hasSodium: false, hasCaffeine: false, verifiedOnly: false, inBoxOnly: false, sort: 'name',
})
const pageSize = 24
const hasNext = computed(() => page.value * pageSize < catalog.total)

function numeric(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function load() {
  return catalog.search({
    ...filters.value,
    carbsMin: numeric(filters.value.carbsMin),
    carbsMax: numeric(filters.value.carbsMax),
    page: page.value,
    pageSize,
  }).catch(() => undefined)
}

function apply(next: typeof filters.value) {
  filters.value = next
  page.value = 1
  void load()
}

function previous() {
  page.value = Math.max(1, page.value - 1)
  void load()
}

function next() {
  if (!hasNext.value) return
  page.value += 1
  void load()
}

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="stack wizard">
    <Stepper :step="2" />
    <h1>Catalogue</h1>
    <p class="label-reminder">Vérifiez toujours l’étiquette de votre produit.</p>
    <CatalogFilters @apply="apply" />
    <AppAlert v-if="catalog.error" :message="catalog.error" />
    <SkeletonCards v-if="catalog.loading" />
    <EmptyState v-else-if="catalog.items.length === 0" title="Aucun produit" text="Élargissez la recherche ou créez le vôtre." />
    <div v-else class="product-grid">
      <ProductTile v-for="product in catalog.items" :key="product.id" :product="product" @add="box.addProduct(product.id)" />
    </div>
    <div class="row">
      <button class="button ghost" type="button" :disabled="page === 1" @click="previous">Page précédente</button>
      <span>Page {{ page }}</span>
      <button class="button ghost" type="button" :disabled="!hasNext" @click="next">Page suivante</button>
    </div>
  </section>
</template>
