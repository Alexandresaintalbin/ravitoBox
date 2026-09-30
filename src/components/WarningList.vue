<script setup lang="ts">
import type { Warning } from '@/engine'

defineProps<{ warnings: Warning[] }>()
</script>

<template>
  <ul v-if="warnings.length" class="stack">
    <li v-for="warning in warnings" :key="warning.code" class="alert error">{{ warning.message }}</li>
  </ul>
</template>
