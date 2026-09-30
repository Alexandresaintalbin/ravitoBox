<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import AppHeader from '@/components/AppHeader.vue'
import FormField from '@/components/FormField.vue'
import { loginSchema } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ email: '', password: '' })
const errors = ref<Record<string, string>>({})

async function submit() {
  errors.value = {}
  const parsed = loginSchema.safeParse(form)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.value[String(issue.path[0])] = issue.message
    return
  }
  try {
    await auth.signIn(parsed.data)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/app'
    await router.push(redirect)
  } catch {
    /* le message est dans le store */
  }
}
</script>

<template>
  <AppHeader guest />
  <main id="contenu" class="shell stack">
    <h1>Connexion</h1>
    <form class="card stack" @submit.prevent="submit">
      <AppAlert v-if="auth.error" :message="auth.error" />
      <FormField label="E-mail" :error="errors.email">
        <input v-model="form.email" type="email" autocomplete="username" required :aria-invalid="Boolean(errors.email)" />
      </FormField>
      <FormField label="Mot de passe" :error="errors.password">
        <input v-model="form.password" type="password" autocomplete="current-password" required :aria-invalid="Boolean(errors.password)" />
      </FormField>
      <button class="button primary" type="submit" :disabled="auth.loading">{{ auth.loading ? 'Connexion…' : 'Se connecter' }}</button>
      <RouterLink to="/mot-de-passe-oublie">Mot de passe oublié</RouterLink>
    </form>
  </main>
</template>
