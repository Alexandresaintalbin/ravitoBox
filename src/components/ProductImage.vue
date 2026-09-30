<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ProductType } from '@/engine/types'
import { imageAlt, publicImageUrl, variantPath } from '@/lib/catalog/images'

const props = defineProps<{ name: string; type: ProductType; imagePath?: string | null; variant?: 'thumb' | 'detail' }>()
const failed = ref(false)
const src = computed(() => {
  if (!props.imagePath || failed.value) return null
  return publicImageUrl(variantPath(props.imagePath, props.variant ?? 'thumb'))
})
</script>

<template>
  <img
    v-if="src"
    class="product-photo"
    :src="src"
    :alt="imageAlt(name)"
    width="160"
    height="160"
    loading="lazy"
    @error="failed = true"
  />
  <span v-else class="product-fallback" :data-type="type" role="img" :aria-label="imageAlt(name)">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect v-if="type === 'barre'" x="10" y="22" width="44" height="18" rx="6" />
      <rect v-else-if="type === 'gel'" x="26" y="8" width="12" height="40" rx="6" />
      <path v-else-if="type === 'boisson' || type === 'eau'" d="M24 10h16l4 40H20z" />
      <ellipse v-else-if="type === 'compote'" cx="32" cy="36" rx="16" ry="18" />
      <circle v-else-if="type === 'pate_de_fruit'" cx="32" cy="34" r="14" />
      <g v-else-if="type === 'capsule_sel'">
        <rect x="16" y="28" width="32" height="10" rx="5" />
        <rect x="28" y="16" width="8" height="32" rx="4" />
      </g>
      <polygon v-else points="32,10 52,50 12,50" />
    </svg>
  </span>
</template>
