<script setup lang="ts">
import type { Product } from '@/lib/mappers'
import { productTypeLabels } from '@/lib/labels'
import { formatGrams, formatMg, formatMl } from '@/lib/format'

defineProps<{ product: Product; preferred?: boolean }>()
defineEmits<{ add: []; copy: []; edit: []; remove: [] }>()
</script>

<template>
  <article class="card stack">
    <header class="row">
      <h3>{{ product.name }}</h3>
      <span v-if="preferred" class="muted">Saveur préférée</span>
    </header>
    <p class="muted">
      {{ productTypeLabels[product.type] }}
      <template v-if="product.flavor"> · {{ product.flavor }}</template>
      <template v-if="product.brand"> · {{ product.brand }}</template>
    </p>
    <p>
      {{ formatGrams(product.carbsG) }} glucides · {{ formatMg(product.sodiumMg) }} sodium
      <template v-if="product.caffeineMg"> · {{ formatMg(product.caffeineMg) }} caféine</template>
      <template v-if="product.volumeMl"> · {{ formatMl(product.volumeMl) }}</template>
    </p>
    <div class="row">
      <button class="button primary" type="button" @click="$emit('add')">Ajouter à la Box</button>
      <button class="button ghost" type="button" @click="$emit('copy')">Personnaliser une copie</button>
      <button v-if="product.scope === 'custom' || product.scope === 'catalog'" class="button ghost" type="button" @click="$emit('edit')">Modifier</button>
      <button v-if="product.scope === 'custom'" class="button warn" type="button" @click="$emit('remove')">Supprimer</button>
    </div>
  </article>
</template>
