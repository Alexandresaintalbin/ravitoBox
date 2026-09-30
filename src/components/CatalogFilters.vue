<script setup lang="ts">
import { productTypeLabels } from '@/lib/labels'

const emit = defineEmits<{
  apply: [filters: {
    text: string
    type: string
    brand: string
    flavor: string
    carbsMin: string
    carbsMax: string
    hasSodium: boolean
    hasCaffeine: boolean
    verifiedOnly: boolean
    inBoxOnly: boolean
    sort: string
  }]
}>()

function apply(event: Event) {
  const data = new FormData(event.target as HTMLFormElement)
  emit('apply', {
    text: String(data.get('text') ?? ''),
    type: String(data.get('type') ?? ''),
    brand: String(data.get('brand') ?? ''),
    flavor: String(data.get('flavor') ?? ''),
    carbsMin: String(data.get('carbsMin') ?? ''),
    carbsMax: String(data.get('carbsMax') ?? ''),
    hasSodium: data.get('hasSodium') === 'on',
    hasCaffeine: data.get('hasCaffeine') === 'on',
    verifiedOnly: data.get('verifiedOnly') === 'on',
    inBoxOnly: data.get('inBoxOnly') === 'on',
    sort: String(data.get('sort') ?? 'name'),
  })
}
</script>

<template>
  <form class="filters" @submit.prevent="apply">
    <label>Recherche <input name="text" type="search" /></label>
    <label>Type
      <select name="type">
        <option value="">Tous</option>
        <option v-for="(label, key) in productTypeLabels" :key="key" :value="key">{{ label }}</option>
      </select>
    </label>
    <label>Marque <input name="brand" /></label>
    <label>Saveur <input name="flavor" /></label>
    <label>Glucides min <input name="carbsMin" inputmode="decimal" /></label>
    <label>Glucides max <input name="carbsMax" inputmode="decimal" /></label>
    <label class="check"><input name="hasSodium" type="checkbox" /> Avec sodium</label>
    <label class="check"><input name="hasCaffeine" type="checkbox" /> Avec caféine</label>
    <label class="check"><input name="verifiedOnly" type="checkbox" /> Vérifiés uniquement</label>
    <label class="check"><input name="inBoxOnly" type="checkbox" /> Ceux de ma Box</label>
    <label>Tri
      <select name="sort">
        <option value="name">Nom</option>
        <option value="brand">Marque</option>
        <option value="carbs">Glucides</option>
      </select>
    </label>
    <button class="button primary" type="submit">Filtrer</button>
  </form>
</template>
