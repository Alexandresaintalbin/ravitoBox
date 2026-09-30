<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ step: 1 | 2 | 3 }>()
const steps = [
  { id: 1, label: 'Ma sortie', to: '/app/sortie' },
  { id: 2, label: 'Mes produits', to: '/app/box' },
  { id: 3, label: 'Mon plan', to: '/app/plans' },
] as const
</script>

<template>
  <nav class="stepper" aria-label="Parcours">
    <ol>
      <li v-for="item in steps" :key="item.id">
        <RouterLink :to="item.to" :aria-current="item.id === step ? 'step' : undefined">{{ item.label }}</RouterLink>
      </li>
    </ol>
    <div class="progress" role="progressbar" :aria-valuenow="step" aria-valuemin="1" aria-valuemax="3" aria-label="Avancement">
      <span :style="{ width: `${(step / 3) * 100}%` }" />
    </div>
  </nav>
</template>
