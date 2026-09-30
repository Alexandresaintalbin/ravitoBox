<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatDate } from '@/lib/format'
import { sessionLabels, sportLabels } from '@/lib/labels'
import { usePlansStore } from '@/stores/plans'

const plans = usePlansStore()
onMounted(() => {
  void plans.list().catch(() => undefined)
})

async function duplicate(id: string) {
  try {
    await plans.duplicate(id)
    await plans.list()
  } catch {
    /* message dans le store */
  }
}
</script>

<template>
  <section class="stack">
    <h1>Plans enregistrés</h1>
    <AppAlert v-if="plans.error" :message="plans.error" />
    <AppSpinner v-if="plans.loading" />
    <EmptyState v-else-if="plans.plans.length === 0" title="Aucun plan" text="Les sorties sauvegardées apparaîtront ici." />
    <ul v-else class="stack">
      <li v-for="plan in plans.plans" :key="plan.id" class="card row">
        <div>
          <strong>{{ plan.title }}</strong>
          <p class="muted">{{ sportLabels[plan.sport] }} · {{ sessionLabels[plan.sessionType] }} · {{ formatDate(plan.createdAt) }}</p>
        </div>
        <RouterLink :to="`/app/plans/${plan.id}`">Ouvrir</RouterLink>
        <button class="button ghost" type="button" @click="duplicate(plan.id)">Dupliquer</button>
        <button class="button warn" type="button" @click="plans.remove(plan.id)">Supprimer</button>
      </li>
    </ul>
  </section>
</template>
