<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppDisclaimer from '@/components/AppDisclaimer.vue'
import AppHeader from '@/components/AppHeader.vue'
</script>

<template>
  <AppHeader />
  <main id="contenu" class="shell">
    <AppDisclaimer />
    <RouterView />
  </main>
</template>
