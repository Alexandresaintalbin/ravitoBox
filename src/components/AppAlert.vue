<script setup lang="ts">
defineProps<{ kind?: 'error' | 'ok'; message: string }>()
</script>

<template>
  <p class="alert" :class="kind ?? 'error'" role="alert">{{ message }}</p>
</template>
