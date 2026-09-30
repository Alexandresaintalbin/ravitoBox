<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import Stepper from '@/components/Stepper.vue'
import FormField from '@/components/FormField.vue'
import ShoppingList from '@/components/ShoppingList.vue'
import Timeline from '@/components/Timeline.vue'
import WarningList from '@/components/WarningList.vue'
import { emptyOuting, useOuting } from '@/composables/useOuting'
import { clearDraft, readDraft, writeDraft } from '@/composables/usePlanDraft'
import { toPlannerProducts } from '@/lib/box'
import { formatGrams, formatMg, formatMl } from '@/lib/format'
import { intensityLabels, sessionLabels, sportLabels, sweatLabels, temperatureLabels, triFormatLabels } from '@/lib/labels'
import { useAuthStore } from '@/stores/auth'
import { useBadgeStore } from '@/stores/badges'
import { useBoxStore } from '@/stores/box'
import { useDebriefStore } from '@/stores/debriefs'
import { usePlansStore } from '@/stores/plans'

const auth = useAuthStore()
const box = useBoxStore()
const plans = usePlansStore()
const debriefs = useDebriefStore()
const badges = useBadgeStore()
const router = useRouter()
const outing = useOuting({ ...emptyOuting(auth.profile?.toleranceGPerHour ?? 60), ...readDraft() })
watch(outing.form, (value) => writeDraft(value), { deep: true })

const plannerProducts = computed(() =>
  toPlannerProducts(box.entries, box.products, auth.profile?.preferredFlavors ?? [], outing.form.value.allowOutsideBox),
)

onMounted(async () => {
  await Promise.all([box.load().catch(() => undefined), plans.list().catch(() => undefined), debriefs.list().catch(() => undefined)])
  outing.refreshGut(debriefs.historyForGut())
})

function generate() {
  outing.generate(plannerProducts.value)
}

async function save() {
  if (!outing.plan.value || !outing.targets.value) return
  const saved = await plans.save({
    form: outing.form.value,
    durationMinutes: outing.durationMinutes.value,
    targets: outing.targets.value,
    plan: outing.plan.value,
  })
  await badges.sync().catch(() => undefined)
  clearDraft()
  await router.push(`/app/plans/${saved.id}`)
}
</script>

<template>
  <section class="stack wizard">
    <Stepper :step="1" />
    <h1>Ma sortie</h1>
    <form class="card stack" @submit.prevent="generate">
      <FormField label="Nom" :error="outing.fieldErrors.value.title">
        <input v-model="outing.form.value.title" required />
      </FormField>
      <div class="filters">
        <FormField label="Sport">
          <select v-model="outing.form.value.sport">
            <option v-for="(label, key) in sportLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </FormField>
        <FormField label="Type de sortie">
          <select v-model="outing.form.value.sessionType">
            <option v-for="(label, key) in sessionLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </FormField>
        <FormField label="Intensité">
          <select v-model="outing.form.value.intensity">
            <option v-for="(label, key) in intensityLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </FormField>
      </div>
      <div v-if="outing.form.value.sport !== 'triathlon'" class="filters">
        <FormField label="Heures" :error="outing.fieldErrors.value.hours"><input v-model.number="outing.form.value.hours" type="number" min="0" max="48" /></FormField>
        <FormField label="Minutes"><input v-model.number="outing.form.value.minutes" type="number" min="0" max="59" /></FormField>
      </div>
      <div v-else class="stack">
        <FormField label="Format" :error="outing.fieldErrors.value.triFormat">
          <select :value="outing.form.value.triFormat ?? ''" @change="outing.setFormat(($event.target as HTMLSelectElement).value as 'sprint')">
            <option value="" disabled>Choisir</option>
            <option v-for="(label, key) in triFormatLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </FormField>
        <div class="filters">
          <FormField label="Natation (min)"><input v-model.number="outing.form.value.swimMin" type="number" min="0" /></FormField>
          <FormField label="T1"><input v-model.number="outing.form.value.t1Min" type="number" min="0" /></FormField>
          <FormField label="Vélo" :error="outing.fieldErrors.value.bikeMin"><input v-model.number="outing.form.value.bikeMin" type="number" min="0" /></FormField>
          <FormField label="T2"><input v-model.number="outing.form.value.t2Min" type="number" min="0" /></FormField>
          <FormField label="Course"><input v-model.number="outing.form.value.runMin" type="number" min="0" /></FormField>
        </div>
      </div>
      <div class="filters">
        <FormField label="Température">
          <select v-model="outing.form.value.temperature">
            <option v-for="(label, key) in temperatureLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </FormField>
        <FormField label="Sudation">
          <select v-model="outing.form.value.sweat">
            <option v-for="(label, key) in sweatLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </FormField>
        <FormField label="Tolérance digestive (g/h)">
          <input v-model.number="outing.form.value.toleranceGPerHour" type="number" min="0" max="200" step="1" />
        </FormField>
        <FormField v-if="outing.form.value.sport === 'trail'" label="Dénivelé (m)" :error="outing.fieldErrors.value.elevationM">
          <input v-model.number="outing.form.value.elevationM" type="number" min="0" />
        </FormField>
      </div>
      <label class="row"><input v-model="outing.form.value.allowOutsideBox" type="checkbox" /> Autoriser des produits hors Box</label>
      <button class="button primary" type="submit">Calculer le plan</button>
    </form>

    <article v-if="outing.gut.value" class="card stack">
      <h2>Gut training</h2>
      <p>{{ outing.gut.value.reason }}</p>
      <p>Proposition : {{ outing.gut.value.suggestedGPerHour }} g/h (applicable sans dépasser la tolérance : {{ outing.gut.value.applicableGPerHour }} g/h).</p>
      <div class="row">
        <button class="button ghost" type="button" @click="outing.acceptGut(false)">Utiliser le palier sûr</button>
        <button v-if="outing.gut.value.requiresConfirmation" class="button ghost" type="button" @click="outing.acceptGut(true)">Confirmer le dépassement</button>
        <button class="button ghost" type="button" @click="outing.ignoreGut()">Ignorer</button>
      </div>
    </article>

    <article v-if="outing.targets.value" class="card stack">
      <h2>Cibles horaires</h2>
      <div class="meters">
        <p class="meter"><strong>{{ formatGrams(outing.targets.value.carbsGPerHour) }}/h</strong> Glucides</p>
        <p class="meter"><strong>{{ formatMl(outing.targets.value.fluidMlPerHour) }}/h</strong> Eau</p>
        <p class="meter"><strong>{{ formatMg(outing.targets.value.sodiumMgPerHour) }}/h</strong> Sodium</p>
      </div>
      <WarningList :warnings="[...outing.targets.value.warnings, ...(outing.plan.value?.warnings ?? [])]" />
      <Timeline v-if="outing.plan.value" :intakes="outing.plan.value.intakes" />
      <ShoppingList v-if="outing.plan.value" :lines="outing.plan.value.shoppingList" />
      <AppAlert v-if="plans.error" :message="plans.error" />
      <button class="button primary" type="button" :disabled="plans.loading" @click="save">Enregistrer dans mon compte</button>
    </article>
  </section>
</template>
