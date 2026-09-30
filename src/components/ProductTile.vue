<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ProductImage from '@/components/ProductImage.vue'
import type { Product } from '@/lib/mappers'
import { formatGrams, formatMg } from '@/lib/format'

defineProps<{ product: Product }>()
defineEmits<{ add: [] }>()
</script>

<template>
  <article class="card product-tile">
    <RouterLink :to="`/app/catalogue/${product.id}`" class="tile-link">
      <ProductImage :name="product.name" :type="product.type" :image-path="product.imagePath" />
      <p class="muted">{{ product.brand || 'Sans marque' }}</p>
      <h3>{{ product.name }}</h3>
      <p>{{ product.servingLabel || 'Portion non précisée' }}</p>
      <p>
        {{ product.carbsKnown === false ? 'glucides non renseignés' : formatGrams(product.carbsG) + ' glucides' }}
        · {{ product.sodiumKnown === false ? 'sodium non renseigné' : formatMg(product.sodiumMg) + ' sodium' }}
      </p>
      <span v-if="product.verified === true" class="badge-pill ok">Vérifié</span>
      <span v-else-if="product.verified === false" class="badge-pill warn">À vérifier</span>
    </RouterLink>
    <button class="button primary" type="button" @click="$emit('add')">Ajouter à ma Box</button>
  </article>
</template>
