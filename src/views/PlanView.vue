<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import ShoppingList from '@/components/ShoppingList.vue'
import Stepper from '@/components/Stepper.vue'
import Timeline from '@/components/Timeline.vue'
import WarningList from '@/components/WarningList.vue'
import { visualsFrom } from '@/lib/catalog/visuals'
import { useBoxStore } from '@/stores/box'
import { formatGrams, formatMg, formatMl } from '@/lib/format'
import { usePlansStore } from '@/stores/plans'

const route = useRoute()
const router = useRouter()
const plans = usePlansStore()
const box = useBoxStore()
const visuals = computed(() => visualsFrom(box.products))

onMounted(() => {
  const id = String(route.params.id)
  void plans.open(id).catch(() => undefined)
  void box.load().catch(() => undefined)
})

async function remove() {
  await plans.remove(String(route.params.id))
  await router.push('/app/plans')
}
</script>

<template>
  <section class="stack wizard">
    <Stepper :step="3" />
    <AppSpinner v-if="plans.loading" />
    <AppAlert v-else-if="plans.error" :message="plans.error" />
    <template v-else-if="plans.current">
      <header class="row">
        <h1>{{ plans.current.title }}</h1>
        <RouterLink class="button primary" :to="`/app/plans/${plans.current.id}/jour-j`">Jour J</RouterLink>
        <RouterLink class="button ghost" :to="`/app/plans/${plans.current.id}/debrief`">Débrief</RouterLink>
        <button class="button warn" type="button" @click="remove">Supprimer</button>
      </header>
      <div class="meters">
        <p class="meter"><strong>{{ formatGrams(plans.current.generatedPlan.totals.carbsG) }}</strong> / {{ formatGrams(plans.current.generatedPlan.targetsTotal.carbsG) }}</p>
        <p class="meter"><strong>{{ formatMl(plans.current.generatedPlan.totals.fluidMl) }}</strong> / {{ formatMl(plans.current.generatedPlan.targetsTotal.fluidMl) }}</p>
        <p class="meter"><strong>{{ formatMg(plans.current.generatedPlan.totals.sodiumMg) }}</strong> / {{ formatMg(plans.current.generatedPlan.targetsTotal.sodiumMg) }}</p>
      </div>
      <WarningList :warnings="plans.current.generatedPlan.warnings" />
      <Timeline :intakes="plans.current.generatedPlan.intakes" :visuals="visuals" />
      <ShoppingList :lines="plans.current.generatedPlan.shoppingList" :visuals="visuals" />
    </template>
  </section>
</template>
