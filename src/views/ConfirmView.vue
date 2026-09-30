<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const message = ref('Vérification du lien…')

onMounted(async () => {
  await auth.init()
  message.value = auth.isAuthenticated
    ? 'Votre adresse est confirmée. Vous pouvez entrer dans ravitoBox.'
    : 'Ouvrez le lien reçu par e-mail pour confirmer le compte, puis connectez-vous.'
})
</script>

<template>
  <AppHeader guest />
  <main id="contenu" class="shell stack">
    <h1>Confirmation</h1>
    <p role="status">{{ message }}</p>
    <RouterLink class="button primary" to="/app">Continuer</RouterLink>
  </main>
</template>
