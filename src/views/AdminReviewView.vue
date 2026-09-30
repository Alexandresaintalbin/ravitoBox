<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppAlert from '@/components/AppAlert.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProductImage from '@/components/ProductImage.vue'
import { useCatalogStore } from '@/stores/catalog'

const catalog = useCatalogStore()
const keepId = ref('')
const dropId = ref('')
const message = ref('')

async function reload() {
  await catalog.search({ page: 1, pageSize: 24 }, 'catalog', true).catch(() => undefined)
  await catalog.loadForks().catch(() => undefined)
}

onMounted(() => {
  void reload()
})

async function verify(id: string) {
  await catalog.markVerified(id).catch(() => undefined)
  await reload()
}

async function merge() {
  message.value = ''
  await catalog.merge(keepId.value, dropId.value).catch(() => undefined)
  if (!catalog.error) message.value = 'Produits fusionnés.'
  await reload()
}

async function promote(id: string) {
  await catalog.promote(id).catch(() => undefined)
  await reload()
}
</script>

<template>
  <section class="stack">
    <h1>À vérifier</h1>
    <p class="muted">Produits incomplets ou non vérifiés. Une fusion exige le même code-barres, ou le même nom et la même marque.</p>
    <AppAlert v-if="catalog.error" :message="catalog.error" />
    <AppAlert v-if="message" :message="message" />
    <AppSpinner v-if="catalog.loading && catalog.items.length === 0" />
    <EmptyState v-else-if="catalog.items.length === 0" title="Rien en attente" text="Le catalogue n’a pas de fiche incomplète à cet instant." />
    <ul v-else class="stack">
      <li v-for="product in catalog.items" :key="product.id" class="card row">
        <ProductImage :name="product.name" :type="product.type" :image-path="product.imagePath" />
        <div>
          <strong>{{ product.brand }} {{ product.name }}</strong>
          <p class="muted">{{ product.dataQuality === 'incomplete' ? 'Incomplet' : 'Complet' }} · {{ product.verified ? 'vérifié' : 'non vérifié' }}</p>
        </div>
        <button class="button primary" type="button" @click="verify(product.id)">Marquer comme vérifié</button>
      </li>
    </ul>
    <form class="card stack" @submit.prevent="merge">
      <h2>Fusionner des doublons</h2>
      <label>Conserver <input v-model="keepId" required /></label>
      <label>Retirer <input v-model="dropId" required /></label>
      <button class="button ghost" type="submit">Fusionner</button>
    </form>
    <h2>Versions corrigées</h2>
    <ul class="stack">
      <li v-for="fork in catalog.forks" :key="fork.id" class="card row">
        <span>{{ fork.name }}</span>
        <button class="button primary" type="button" @click="promote(fork.id)">Promouvoir dans le catalogue</button>
      </li>
    </ul>
    <p v-if="catalog.forks.length === 0" class="muted">Aucune version personnelle à promouvoir.</p>
  </section>
</template>
