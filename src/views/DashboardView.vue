<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import AppSpinner from '@/components/AppSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatDate } from '@/lib/format'
import { sessionLabels, sportLabels } from '@/lib/labels'
import { useAuthStore } from '@/stores/auth'
import { usePlansStore } from '@/stores/plans'

const auth = useAuthStore()
const plans = usePlansStore()

onMounted(() => {
  void plans.list().catch(() => undefined)
})
</script>

<template>
  <section class="stack">
    <h1>Bonjour {{ auth.profile?.pseudo ?? 'athlète' }}</h1>
    <p class="lede">Préparez la prochaine sortie à partir de ce que vous avez vraiment dans la Box.</p>
    <div class="row">
      <RouterLink class="button primary" to="/app/sortie">Planifier une sortie</RouterLink>
      <RouterLink class="button ghost" to="/app/box">Remplir la Box</RouterLink>
    </div>
    <AppSpinner v-if="plans.loading" />
    <EmptyState v-else-if="plans.plans.length === 0" title="Aucun plan" text="Votre première feuille de route se crée en quelques minutes." />
    <ul v-else class="stack">
      <li v-for="plan in plans.plans.slice(0, 4)" :key="plan.id" class="card row">
        <div>
          <strong>{{ plan.title }}</strong>
          <p class="muted">{{ sportLabels[plan.sport] }} · {{ sessionLabels[plan.sessionType] }} · {{ formatDate(plan.createdAt) }}</p>
        </div>
        <RouterLink :to="`/app/plans/${plan.id}`">Ouvrir</RouterLink>
      </li>
    </ul>
  </section>
</template>
