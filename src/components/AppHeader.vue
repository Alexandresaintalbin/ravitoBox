<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useAuthStore } from '@/stores/auth'

defineProps<{ guest?: boolean }>()
const open = ref(false)
const route = useRoute()
const auth = useAuthStore()

async function logout() {
  await auth.signOut()
  open.value = false
}
</script>

<template>
  <a class="skip" href="#contenu">Aller au contenu</a>
  <header class="shell topbar no-print">
    <RouterLink class="brand" to="/" @click="open = false">
      <AppLogo />
      <strong>ravito<span>Box</span></strong>
    </RouterLink>
    <button class="button ghost menu-toggle" type="button" :aria-expanded="open" @click="open = !open">Menu</button>
    <nav class="nav" :class="{ open }" aria-label="Navigation principale">
      <template v-if="auth.isAuthenticated && !guest">
        <RouterLink to="/app" :aria-current="route.name === 'dashboard' ? 'page' : undefined">Tableau</RouterLink>
        <RouterLink to="/app/box" :aria-current="route.name === 'box' ? 'page' : undefined">Ma Box</RouterLink>
        <RouterLink to="/app/catalogue">Catalogue</RouterLink>
        <RouterLink to="/app/sortie">Nouvelle sortie</RouterLink>
        <RouterLink to="/app/plans">Plans</RouterLink>
        <RouterLink to="/app/badges">Badges</RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/app/admin/catalogue">Catalogue admin</RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/app/admin/verification">À vérifier</RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/app/admin/comptes">Comptes</RouterLink>
        <RouterLink to="/app/compte">Compte</RouterLink>
        <button class="button ghost" type="button" @click="logout">Déconnexion</button>
      </template>
      <template v-else>
        <RouterLink to="/connexion">Connexion</RouterLink>
        <RouterLink class="button primary" to="/inscription">Créer un compte</RouterLink>
      </template>
      <ThemeToggle />
    </nav>
  </header>
</template>
