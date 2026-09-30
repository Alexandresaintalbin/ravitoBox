<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const tabs = [
  { label: 'Accueil', to: '/app', name: 'dashboard' },
  { label: 'Ma Box', to: '/app/box', name: 'box' },
  { label: 'Mes plans', to: '/app/plans', name: 'plans' },
  { label: 'Compte', to: '/app/compte', name: 'account' },
]
</script>

<template>
  <nav class="tabbar no-print" aria-label="Navigation mobile">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.name"
      :to="tab.to"
      :aria-current="route.name === tab.name ? 'page' : undefined"
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>
