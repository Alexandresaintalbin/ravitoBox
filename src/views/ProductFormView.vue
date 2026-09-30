<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import FormField from '@/components/FormField.vue'
import { FLAVORS } from '@/lib/flavors'
import { productTypeLabels } from '@/lib/labels'
import type { ProductType } from '@/engine/types'
import { productSchema } from '@/schemas/product'
import { useBoxStore } from '@/stores/box'

const route = useRoute()
const router = useRouter()
const box = useBoxStore()
const errors = ref<Record<string, string>>({})
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

onMounted(async () => {
  await box.load().catch(() => undefined)
  const id = typeof route.params.id === 'string' ? route.params.id : ''
  const existing = box.products.find((product) => product.id === id && product.scope === 'custom')
  if (!existing) return
  form.name = existing.name
  form.brand = existing.brand ?? ''
  form.productType = existing.type
  form.flavor = existing.flavor ?? ''
  form.carbsG = existing.carbsG
  form.sodiumMg = existing.sodiumMg
  form.caffeineMg = existing.caffeineMg
  form.volumeMl = existing.volumeMl
})

async function submit() {
  errors.value = {}
  const parsed = productSchema.safeParse({ ...form, volumeMl: form.volumeMl === null || Number.isNaN(form.volumeMl) ? null : form.volumeMl })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.value[String(issue.path[0])] = issue.message
    return
  }
  const id = typeof route.params.id === 'string' ? route.params.id : undefined
  try {
    await box.saveProduct(parsed.data, 'custom', id)
    await router.push('/app/box')
  } catch {
    /* message store */
  }
}
</script>

<template>
  <section class="stack">
    <h1>{{ route.params.id ? 'Modifier le produit' : 'Nouveau produit' }}</h1>
    <p class="muted">Produit privé, visible uniquement dans votre compte. Les valeurs sont par portion.</p>
    <form class="card stack" @submit.prevent="submit">
      <AppAlert v-if="box.error" :message="box.error" />
      <FormField label="Nom" :error="errors.name">
        <input v-model="form.name" required />
      </FormField>
      <FormField label="Marque (facultatif)" :error="errors.brand">
        <input v-model="form.brand" />
      </FormField>
      <FormField label="Type" :error="errors.productType">
        <select v-model="form.productType">
          <option v-for="(label, key) in productTypeLabels" :key="key" :value="key">{{ label }}</option>
        </select>
      </FormField>
      <FormField label="Saveur" :error="errors.flavor">
        <input v-model="form.flavor" list="flavors" />
        <datalist id="flavors">
          <option v-for="item in FLAVORS" :key="item" :value="item" />
        </datalist>
      </FormField>
      <FormField label="Glucides (g)" :error="errors.carbsG"><input v-model.number="form.carbsG" type="number" min="0" step="0.1" /></FormField>
      <FormField label="Sodium (mg)" :error="errors.sodiumMg"><input v-model.number="form.sodiumMg" type="number" min="0" step="1" /></FormField>
      <FormField label="Caféine (mg)" :error="errors.caffeineMg"><input v-model.number="form.caffeineMg" type="number" min="0" step="1" /></FormField>
      <FormField label="Volume (ml, facultatif)" :error="errors.volumeMl"><input v-model.number="form.volumeMl" type="number" min="0" step="1" /></FormField>
      <button class="button primary" type="submit" :disabled="box.loading">Enregistrer</button>
    </form>
  </section>
</template>
