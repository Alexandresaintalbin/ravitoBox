<script setup lang="ts">
import { onMounted } from 'vue'
import AppAlert from '@/components/AppAlert.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatDate } from '@/lib/format'
import { useBadgeStore } from '@/stores/badges'

const badges = useBadgeStore()
onMounted(() => {
  void badges.sync().catch(() => undefined)
})
</script>

<template>
  <section class="stack">
    <h1>Médailles de progression</h1>
    <p class="muted">Elles marquent des étapes, pas une performance. Rien n’est attribué sans l’action correspondante.</p>
    <AppAlert v-if="badges.error" :message="badges.error" />
    <AppSpinner v-if="badges.loading" />
    <EmptyState v-else-if="badges.badges.length === 0" title="Pas encore de médailles" text="Enregistrez une sortie pour ouvrir le tableau." />
    <ul v-else class="badge-grid">
      <li v-for="badge in badges.badges" :key="badge.id" class="card badge" :class="{ earned: badge.earnedAt }">
        <h2>{{ badge.name }}</h2>
        <p>{{ badge.description }}</p>
        <p v-if="badge.earnedAt" class="muted">Obtenue le {{ formatDate(badge.earnedAt) }}</p>
      </li>
    </ul>
  </section>
</template>
