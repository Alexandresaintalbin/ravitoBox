<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import Stepper from '@/components/Stepper.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProductCard from '@/components/ProductCard.vue'
import QuantityInput from '@/components/QuantityInput.vue'
import { useProductFilters } from '@/composables/useProductFilters'
import { FLAVORS } from '@/lib/flavors'
import { productTypeLabels } from '@/lib/labels'
import { useAuthStore } from '@/stores/auth'
import { useBoxStore } from '@/stores/box'

const auth = useAuthStore()
const box = useBoxStore()
const preferred = computed(() => auth.profile?.preferredFlavors ?? [])
const showCatalog = ref(false)
const catalog = computed(() => box.catalog)
const { type, flavor, query, filtered } = useProductFilters(catalog, preferred)

onMounted(() => {
  void box.load().catch(() => undefined)
})

function quantityOf(productId: string) {
  return box.entries.find((entry) => entry.product.id === productId)?.quantity ?? 1
}

async function setQuantity(productId: string, quantity: number) {
  await box.updateItem(productId, { quantity }).catch(() => undefined)
}
</script>

<template>
  <section class="stack wizard">
    <Stepper :step="2" />
    <header class="row">
      <h1>Ma Box</h1>
      <RouterLink class="button primary" to="/app/catalogue">Parcourir le catalogue</RouterLink>
      <RouterLink class="button ghost" to="/app/produits/nouveau">Créer un produit</RouterLink>
      <button class="button ghost" type="button" @click="showCatalog = !showCatalog">
        {{ showCatalog ? 'Fermer le catalogue' : 'Ajouter depuis le catalogue' }}
      </button>
    </header>
    <AppAlert v-if="box.error" :message="box.error" />
    <AppSpinner v-if="box.loading && box.entries.length === 0" />
    <EmptyState v-else-if="box.entries.length === 0" title="Box vide" text="Ajoutez un produit du catalogue ou créez le vôtre." />
    <ul v-else class="stack">
      <li v-for="entry in box.entries" :key="entry.product.id" class="card stack">
        <div class="row">
          <strong>{{ entry.product.name }}</strong>
          <span class="muted">{{ productTypeLabels[entry.product.type] }}</span>
          <span v-if="entry.favorite">Favori</span>
        </div>
        <QuantityInput :model-value="entry.quantity" @update:model-value="setQuantity(entry.product.id, $event)" />
        <div class="row">
          <button class="button ghost" type="button" @click="box.toggleFavorite(entry.product.id, !entry.favorite)">
            {{ entry.favorite ? 'Retirer des favoris' : 'Favori' }}
          </button>
          <button class="button ghost" type="button" @click="box.updateItem(entry.product.id, { excluded: !entry.excluded })">
            {{ entry.excluded ? 'Réintégrer au plan' : 'Exclure du plan' }}
          </button>
          <button class="button warn" type="button" @click="box.removeItem(entry.product.id)">Retirer</button>
        </div>
      </li>
    </ul>

    <section v-if="showCatalog" class="stack">
      <h2>Catalogue générique</h2>
      <p class="muted">Valeurs indicatives par portion. Vérifiez l’étiquette avant de les utiliser.</p>
      <div class="filters">
        <label>Type
          <select v-model="type">
            <option value="tous">Tous</option>
            <option v-for="(label, key) in productTypeLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label>Saveur
          <select v-model="flavor">
            <option value="toutes">Toutes</option>
            <option v-for="item in FLAVORS" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label>Recherche
          <input v-model="query" type="search" />
        </label>
      </div>
      <ProductCard
        v-for="product in filtered"
        :key="product.id"
        :product="product"
        :preferred="preferred.includes(product.flavor ?? '')"
        @add="box.addProduct(product.id, Math.max(1, quantityOf(product.id)))"
        @copy="box.copyProduct(product.id)"
      />
      <p v-if="filtered.length === 0" class="muted">Aucun produit ne correspond.</p>
    </section>
  </section>
</template>
