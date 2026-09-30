<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import SensationScale from '@/components/SensationScale.vue'
import { writeDraft } from '@/composables/usePlanDraft'
import { applyAdjustment } from '@/lib/apply-adjustment'
import { adjustmentsFor } from '@/stores/debriefs'
import { useAuthStore } from '@/stores/auth'
import { useBadgeStore } from '@/stores/badges'
import { useDebriefStore } from '@/stores/debriefs'
import { usePlansStore } from '@/stores/plans'

const route = useRoute()
const plans = usePlansStore()
const debriefs = useDebriefStore()
const auth = useAuthStore()
const badges = useBadgeStore()
const confirmExceed = ref(false)
const notice = ref('')
const form = reactive({ energy: 3, stomach: 3, thirst: 3, notes: '', consumed: [] as { productId: string; productName: string; quantity: number }[] })

onMounted(async () => {
  const id = String(route.params.id)
  const plan = await plans.open(id).catch(() => null)
  await debriefs.list(id).catch(() => undefined)
  if (!plan) return
  const counts = new Map<string, { productId: string; productName: string; quantity: number }>()
  for (const intake of plan.generatedPlan?.intakes ?? []) {
    const current = counts.get(intake.productId) ?? { productId: intake.productId, productName: intake.productName, quantity: 0 }
    current.quantity += 1
    counts.set(intake.productId, current)
  }
  form.consumed = [...counts.values()]
})

const proposals = computed(() => {
  if (!plans.current?.generatedPlan || !plans.current.targets) return []
  return adjustmentsFor(plans.current, form, auth.profile?.toleranceGPerHour ?? plans.current.targets.carbsGPerHour)
})

async function submit() {
  notice.value = ''
  try {
    await debriefs.create(String(route.params.id), form)
    await badges.sync()
    notice.value = 'Débrief enregistré. Les propositions ci-dessous ne sont pas appliquées tant que vous ne le demandez pas.'
  } catch {
    notice.value = ''
  }
}

function prepare(id: string) {
  const adjustment = proposals.value.find((item) => item.id === id)
  if (!adjustment || !plans.current) return
  const next = applyAdjustment({ ...plans.current.parameters, title: `Suite de ${plans.current.title}`.slice(0, 80) }, adjustment, confirmExceed.value)
  notice.value = next.reason
  if (next.applied) writeDraft(next.form)
}
</script>

<template>
  <section class="stack">
    <h1>Débrief</h1>
    <AppSpinner v-if="plans.loading" />
    <form v-else-if="plans.current" class="card stack" @submit.prevent="submit">
      <AppAlert v-if="debriefs.error" :message="debriefs.error" />
      <AppAlert v-if="notice" kind="ok" :message="notice" />
      <SensationScale v-model="form.energy" label="Énergie" />
      <SensationScale v-model="form.stomach" label="Estomac" />
      <SensationScale v-model="form.thirst" label="Soif" />
      <fieldset class="stack">
        <legend>Réellement consommé</legend>
        <label v-for="item in form.consumed" :key="item.productId">
          {{ item.productName }}
          <input v-model.number="item.quantity" type="number" min="0" max="99" />
        </label>
      </fieldset>
      <label>Notes
        <textarea v-model="form.notes" maxlength="2000" />
      </label>
      <button class="button primary" type="submit" :disabled="debriefs.loading">Enregistrer le débrief</button>
    </form>
    <article v-if="proposals.length" class="card stack">
      <h2>Propositions pour la prochaine sortie</h2>
      <label class="row"><input v-model="confirmExceed" type="checkbox" /> Je confirme un éventuel dépassement de ma tolérance</label>
      <div v-for="proposal in proposals" :key="proposal.id" class="stack">
        <p><strong>{{ proposal.label }}</strong> — {{ proposal.detail }}</p>
        <button class="button ghost" type="button" @click="prepare(proposal.id)">Préparer la prochaine sortie avec ceci</button>
      </div>
    </article>
    <section v-if="debriefs.items.length" class="stack">
      <h2>Historique</h2>
      <article v-for="item in debriefs.items" :key="item.id" class="card">
        <p>Énergie {{ item.energy }} · Estomac {{ item.stomach }} · Soif {{ item.thirst }}</p>
        <p v-if="item.notes">{{ item.notes }}</p>
      </article>
    </section>
  </section>
</template>
