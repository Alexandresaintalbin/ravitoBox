<template>
  <div class="product-grid" aria-hidden="true">
    <div v-for="index in 6" :key="index" class="skeleton card" />
  </div>
  <p class="sr-only" role="status">Chargement du catalogue</p>
</template>
