<script setup lang="ts">
defineProps<{ label: string; error?: string; hint?: string }>()
</script>

<template>
  <label>
    <span>{{ label }}</span>
    <slot />
    <span v-if="hint" class="muted">{{ hint }}</span>
    <span v-if="error" class="field-error">{{ error }}</span>
  </label>
</template>
