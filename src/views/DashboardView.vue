<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import AppSpinner from '@/components/AppSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatDate } from '@/lib/format'
import { sessionLabels, sportLabels } from '@/lib/labels'
import { useAuthStore } from '@/stores/auth'
import { useDebriefStore } from '@/stores/debriefs'
import { usePlansStore } from '@/stores/plans'

const auth = useAuthStore()
const plans = usePlansStore()
const debriefs = useDebriefStore()
const nextPlan = computed(() => plans.plans[0] ?? null)
const lastDebrief = computed(() => debriefs.items[0] ?? null)

onMounted(() => {
  void plans.list().catch(() => undefined)
  void debriefs.list().catch(() => undefined)
})
</script>

<template>
  <section class="stack">
    <h1>Bonjour {{ auth.profile?.pseudo ?? 'athlète' }}</h1>
    <p class="lede">Préparez la prochaine sortie à partir de ce que vous avez vraiment dans la Box.</p>
    <div class="row">
      <RouterLink class="button primary" to="/app/sortie">Nouveau plan</RouterLink>
      <RouterLink class="button ghost" to="/app/box">Ma Box</RouterLink>
    </div>
    <article v-if="nextPlan" class="card stack">
      <h2>Prochaine sortie</h2>
      <p><strong>{{ nextPlan.title }}</strong></p>
      <p class="muted">{{ sportLabels[nextPlan.sport] }} · {{ sessionLabels[nextPlan.sessionType] }}</p>
      <RouterLink class="button primary" :to="`/app/plans/${nextPlan.id}`">Ouvrir le plan</RouterLink>
    </article>
    <article v-if="lastDebrief" class="card stack">
      <h2>Dernier débrief</h2>
      <p class="muted">{{ formatDate(lastDebrief.createdAt) }}</p>
      <RouterLink :to="`/app/plans/${lastDebrief.planId}/debrief`">Revoir</RouterLink>
    </article>
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
