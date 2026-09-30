<script setup lang="ts">
import type { PlanIntake } from '@/engine'
import { formatMinute } from '@/engine'
import { segmentLabels } from '@/lib/labels'

defineProps<{ intakes: PlanIntake[] }>()
</script>

<template>
  <ol v-if="intakes.length" class="timeline">
    <li v-for="(intake, index) in intakes" :key="`${intake.minute}-${intake.productId}-${index}`" class="intake">
      <strong>{{ formatMinute(intake.minute) }}</strong>
      <span>
        {{ intake.productName }}
        <small class="muted">{{ segmentLabels[intake.segment] }}</small>
      </span>
      <span class="muted">{{ intake.carbsG }} g · {{ intake.fluidMl }} ml · {{ intake.sodiumMg }} mg</span>
    </li>
  </ol>
  <p v-else class="muted">Aucune prise pour le moment.</p>
</template>
