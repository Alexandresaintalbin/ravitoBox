<script setup lang="ts">
defineProps<{ title: string; text: string }>()
</script>

<template>
  <div class="card stack">
    <h2>{{ title }}</h2>
    <p class="muted">{{ text }}</p>
    <slot />
  </div>
</template>
