<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppDisclaimer from '@/components/AppDisclaimer.vue'
import AppHeader from '@/components/AppHeader.vue'
import Attribution from '@/components/Attribution.vue'
import TabBar from '@/components/TabBar.vue'
</script>

<template>
  <AppHeader />
  <main id="contenu" class="shell app-main">
    <AppDisclaimer />
    <RouterView />
    <Attribution />
  </main>
  <TabBar />
</template>
