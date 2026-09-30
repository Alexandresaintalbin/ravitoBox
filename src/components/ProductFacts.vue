<script setup lang="ts">
import ProductImage from '@/components/ProductImage.vue'
import type { Product } from '@/lib/mappers'
import { formatGrams, formatMg } from '@/lib/format'

defineProps<{ product: Product }>()

function known(flag: boolean | undefined, text: string) {
  return flag === false ? 'non renseigné' : text
}
</script>

<template>
  <article class="stack product-sheet">
    <ProductImage :name="product.name" :type="product.type" :image-path="product.imagePath" variant="detail" />
    <p class="muted">{{ product.brand || 'Sans marque' }}</p>
    <h1>{{ product.name }}</h1>
    <p class="label-reminder">Vérifiez toujours l’étiquette de votre produit.</p>
    <p>
      <span v-if="product.verified === true" class="badge-pill ok">Vérifié</span>
      <span v-else class="badge-pill warn">À vérifier</span>
      <span v-if="product.dataQuality === 'incomplete'" class="badge-pill warn">Données incomplètes</span>
    </p>
    <p>{{ product.servingLabel || 'Portion non précisée' }}</p>
    <h2>Par portion</h2>
    <ul>
      <li>Glucides : {{ known(product.carbsKnown, formatGrams(product.carbsG)) }}</li>
      <li>Sucres : {{ product.sugarsG == null ? 'non renseigné' : formatGrams(product.sugarsG) }}</li>
      <li>Énergie : {{ product.energyKj == null ? 'non renseigné' : `${product.energyKj} kJ` }}</li>
      <li>Sodium : {{ known(product.sodiumKnown, formatMg(product.sodiumMg)) }}</li>
      <li>Caféine : {{ known(product.caffeineKnown, formatMg(product.caffeineMg)) }}</li>
    </ul>
    <h2>Pour 100 {{ product.servingUnit === 'ml' ? 'ml' : 'g' }}</h2>
    <ul>
      <li>Glucides : {{ product.carbsPer100 == null ? 'non renseigné' : formatGrams(product.carbsPer100) }}</li>
      <li>Sucres : {{ product.sugarsPer100 == null ? 'non renseigné' : formatGrams(product.sugarsPer100) }}</li>
      <li>Énergie : {{ product.energyKjPer100 == null ? 'non renseigné' : `${product.energyKjPer100} kJ` }}</li>
      <li>Sodium : {{ product.sodiumPer100 == null ? 'non renseigné' : formatMg(product.sodiumPer100) }}</li>
      <li>Caféine : {{ product.caffeinePer100 == null ? 'non renseigné' : formatMg(product.caffeinePer100) }}</li>
    </ul>
    <p>Source : {{ product.source === 'off' ? 'Open Food Facts' : product.source === 'user' ? 'version personnelle' : 'saisie manuelle' }}</p>
    <p v-if="product.offLastModified">Mise à jour : {{ product.offLastModified }}</p>
    <p v-if="product.imageCredit">Crédit image : {{ product.imageCredit }}</p>
    <p v-if="product.indicativePriceEur != null">Prix indicatif saisi à la main : {{ product.indicativePriceEur }} €</p>
    <p v-if="product.buyUrl"><a :href="product.buyUrl" rel="noreferrer">Où l’acheter</a></p>
    <p v-if="product.sourceUrl"><a :href="product.sourceUrl" rel="noreferrer">Voir sur Open Food Facts</a></p>
    <p class="attribution-inline">Données : Open Food Facts (licence ODbL) — Images : contributeurs Open Food Facts (CC BY-SA)</p>
  </article>
</template>
