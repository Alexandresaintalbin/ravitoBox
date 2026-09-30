<script setup lang="ts">
const quantity = defineModel<number>({ required: true })

function change(delta: number) {
  quantity.value = Math.min(9999, Math.max(0, quantity.value + delta))
}
</script>

<template>
  <div class="qty">
    <button type="button" aria-label="Diminuer la quantité" @click="change(-1)">−</button>
    <input v-model.number="quantity" type="number" min="0" max="9999" aria-label="Quantité" />
    <button type="button" aria-label="Augmenter la quantité" @click="change(1)">+</button>
  </div>
</template>
