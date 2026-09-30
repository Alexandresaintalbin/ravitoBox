<script setup lang="ts">
defineProps<{ label: string }>()
const model = defineModel<number>({ required: true })
</script>

<template>
  <fieldset class="stack">
    <legend>{{ label }}</legend>
    <div class="scale" role="group" :aria-label="label">
      <button
        v-for="value in [1, 2, 3, 4, 5]"
        :key="value"
        type="button"
        class="button ghost"
        :aria-pressed="model === value"
        @click="model = value"
      >
        {{ value }}
      </button>
    </div>
  </fieldset>
</template>
