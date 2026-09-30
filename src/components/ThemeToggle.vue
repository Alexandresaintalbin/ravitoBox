<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { theme, toggle } = useTheme()
</script>

<template>
  <button class="button ghost" type="button" :aria-pressed="theme === 'dark'" @click="toggle">
    {{ theme === 'dark' ? 'Thème clair' : 'Thème sombre' }}
  </button>
</template>
