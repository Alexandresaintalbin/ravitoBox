<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ShoppingLine } from '@/engine'
import ProductImage from '@/components/ProductImage.vue'
import type { ProductVisual } from '@/lib/catalog/visuals'
import { groupShopping, shoppingText } from '@/lib/catalog/shopping'
import { downloadText } from '@/lib/download'

const props = defineProps<{ lines: ShoppingLine[]; visuals?: Record<string, ProductVisual> }>()
const copied = ref('')
const groups = computed(() => groupShopping(props.lines))

async function copy() {
  const text = shoppingText(props.lines)
  try {
    await navigator.clipboard.writeText(text)
    copied.value = 'Liste copiée.'
  } catch {
    copied.value = text
  }
}

function exportList() {
  downloadText('liste-de-courses.txt', shoppingText(props.lines))
}
</script>

<template>
  <div class="stack">
    <h3>À emporter</h3>
    <ul>
      <li v-for="line in lines.filter((item) => item.toBring > 0)" :key="`bring-${line.productId}`" class="row">
        <ProductImage
          v-if="visuals?.[line.productId]"
          :name="line.name"
          :type="visuals[line.productId]?.type || line.productType || 'autre'"
          :image-path="visuals[line.productId]?.imagePath || line.imagePath"
        />
        {{ line.name }} × {{ line.toBring }}
      </li>
    </ul>
    <p v-if="!lines.some((line) => line.toBring > 0)" class="muted">Rien à emporter avec le stock actuel.</p>
    <h3>Manque dans la Box</h3>
    <section v-for="group in groups" :key="group.brand" class="stack">
      <h4>{{ group.brand }}</h4>
      <ul>
        <li v-for="line in group.lines" :key="`miss-${line.productId}`" class="row">
          <ProductImage
            v-if="line.imagePath || visuals?.[line.productId]"
            :name="line.name"
            :type="line.productType || visuals?.[line.productId]?.type || 'autre'"
            :image-path="line.imagePath || visuals?.[line.productId]?.imagePath"
          />
          {{ line.name }} × {{ line.missing }} {{ line.inBox ? 'en plus du stock' : 'à prévoir' }}
        </li>
      </ul>
    </section>
    <p v-if="groups.length === 0" class="muted">Le stock couvre la liste.</p>
    <div class="row">
      <button class="button ghost" type="button" @click="copy">Copier la liste</button>
      <button class="button ghost" type="button" @click="exportList">Exporter le texte</button>
    </div>
    <p v-if="copied" class="muted">{{ copied }}</p>
  </div>
</template>
