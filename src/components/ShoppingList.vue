<script setup lang="ts">
import type { ShoppingLine } from '@/engine'

defineProps<{ lines: ShoppingLine[] }>()
</script>

<template>
  <div class="stack">
    <h3>À emporter</h3>
    <ul>
      <li v-for="line in lines.filter((item) => item.toBring > 0)" :key="`bring-${line.productId}`">
        {{ line.name }} × {{ line.toBring }}
      </li>
    </ul>
    <p v-if="!lines.some((line) => line.toBring > 0)" class="muted">Rien à emporter avec le stock actuel.</p>
    <h3>Manque dans la Box</h3>
    <ul>
      <li v-for="line in lines.filter((item) => item.missing > 0)" :key="`miss-${line.productId}`">
        {{ line.name }} × {{ line.missing }} {{ line.inBox ? 'en plus du stock' : 'à prévoir' }}
      </li>
    </ul>
    <p v-if="!lines.some((line) => line.missing > 0)" class="muted">Le stock couvre la liste.</p>
  </div>
</template>
