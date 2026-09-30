<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import ProductImage from '@/components/ProductImage.vue'
import { visualsFrom } from '@/lib/catalog/visuals'
import { useBoxStore } from '@/stores/box'
import { formatPlanText, formatMinute } from '@/engine'
import { downloadText } from '@/lib/download'
import { segmentLabels } from '@/lib/labels'
import { usePlansStore } from '@/stores/plans'

const route = useRoute()
const plans = usePlansStore()
const box = useBoxStore()
const visuals = computed(() => visualsFrom(box.products))
onMounted(() => {
  void plans.open(String(route.params.id)).catch(() => undefined)
  void box.load().catch(() => undefined)
})
const plan = computed(() => plans.current)
function printPage() {
  window.print()
}
function exportText() {
  if (!plan.value) return
  downloadText(`${plan.value.title}.txt`, formatPlanText(plan.value.title, plan.value.generatedPlan))
}
</script>

<template>
  <section class="race stack">
    <AppSpinner v-if="plans.loading" />
    <AppAlert v-else-if="plans.error" :message="plans.error" />
    <template v-else-if="plan">
      <header class="row no-print">
        <h1>{{ plan.title }}</h1>
        <button class="button ghost" type="button" @click="printPage">Imprimer</button>
        <button class="button ghost" type="button" @click="exportText">Exporter le texte</button>
      </header>
      <ol class="timeline">
        <li v-for="(intake, index) in plan.generatedPlan.intakes" :key="index" class="intake">
          <strong>{{ formatMinute(intake.minute) }}</strong>
          <ProductImage
            v-if="visuals[intake.productId]"
            :name="intake.productName"
            :type="visuals[intake.productId]?.type || intake.productType"
            :image-path="visuals[intake.productId]?.imagePath"
          />
          <span>{{ intake.productName }} · {{ segmentLabels[intake.segment] }}</span>
        </li>
      </ol>
      <p class="disclaimer">Indicatif : validez avec un professionnel et testez à l’entraînement.</p>
    </template>
  </section>
</template>
