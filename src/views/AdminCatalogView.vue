<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import AppAlert from '@/components/AppAlert.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import { productTypeLabels } from '@/lib/labels'
import type { ProductType } from '@/engine/types'
import { productSchema } from '@/schemas/product'
import { useBoxStore } from '@/stores/box'

const box = useBoxStore()
const editing = ref<string | undefined>(undefined)
const errors = ref('')
const form = reactive({
  name: '',
  brand: '',
  productType: 'gel' as ProductType,
  flavor: '',
  carbsG: 20,
  sodiumMg: 40,
  caffeineMg: 0,
  volumeMl: null as number | null,
})

onMounted(() => {
  void box.load().catch(() => undefined)
})

function edit(id: string) {
  const product = box.catalog.find((item) => item.id === id)
  if (!product) return
  editing.value = id
  form.name = product.name
  form.brand = product.brand ?? ''
  form.productType = product.type
  form.flavor = product.flavor ?? ''
  form.carbsG = product.carbsG
  form.sodiumMg = product.sodiumMg
  form.caffeineMg = product.caffeineMg
  form.volumeMl = product.volumeMl
}

async function submit() {
  errors.value = ''
  const parsed = productSchema.safeParse({
    ...form,
    brand: form.brand || null,
    flavor: form.flavor || null,
    volumeMl: form.volumeMl == null || Number.isNaN(form.volumeMl) ? null : form.volumeMl,
  })
  if (!parsed.success) {
    errors.value = parsed.error.issues[0]?.message ?? 'Produit invalide.'
    return
  }
  try {
    await box.saveProduct(parsed.data, 'catalog', editing.value)
    editing.value = undefined
    form.name = ''
  } catch {
    errors.value = box.error ?? 'Enregistrement impossible.'
  }
}
</script>

<template>
  <section class="stack">
    <h1>Catalogue commun</h1>
    <p class="muted">Réservé aux administrateurs. Les produits restent génériques : pas de marque réelle inventée.</p>
    <AppSpinner v-if="box.loading && box.catalog.length === 0" />
    <AppAlert v-if="errors || box.error" :message="errors || box.error || ''" />
    <ul class="stack">
      <li v-for="product in box.catalog" :key="product.id" class="card row">
        <span>{{ product.name }} · {{ productTypeLabels[product.type] }}</span>
        <button class="button ghost" type="button" @click="edit(product.id)">Modifier</button>
        <button class="button warn" type="button" @click="box.deleteProduct(product.id)">Supprimer</button>
      </li>
    </ul>
    <form class="card stack" @submit.prevent="submit">
      <h2>{{ editing ? 'Modifier' : 'Ajouter au catalogue' }}</h2>
      <label>Nom <input v-model="form.name" required /></label>
      <label>Type
        <select v-model="form.productType">
          <option v-for="(label, key) in productTypeLabels" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <label>Saveur <input v-model="form.flavor" /></label>
      <label>Glucides <input v-model.number="form.carbsG" type="number" min="0" /></label>
      <label>Sodium <input v-model.number="form.sodiumMg" type="number" min="0" /></label>
      <label>Caféine <input v-model.number="form.caffeineMg" type="number" min="0" /></label>
      <label>Volume <input v-model.number="form.volumeMl" type="number" min="0" /></label>
      <button class="button primary" type="submit">Enregistrer</button>
    </form>
  </section>
</template>
