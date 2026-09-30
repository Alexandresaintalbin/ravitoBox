<script setup lang="ts">
import { ref } from 'vue'
import AppAlert from '@/components/AppAlert.vue'
import AppHeader from '@/components/AppHeader.vue'
import FormField from '@/components/FormField.vue'
import { forgotPasswordSchema } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const email = ref('')
const error = ref('')
const sent = ref(false)

async function submit() {
  error.value = ''
  const parsed = forgotPasswordSchema.safeParse({ email: email.value })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'E-mail invalide.'
    return
  }
  try {
    await auth.requestPasswordReset(parsed.data.email)
    sent.value = true
  } catch {
    sent.value = false
  }
}
</script>

<template>
  <AppHeader guest />
  <main id="contenu" class="shell stack">
    <h1>Mot de passe oublié</h1>
    <AppAlert v-if="sent" kind="ok" message="Si un compte existe, un lien de réinitialisation a été envoyé." />
    <form v-else class="card stack" @submit.prevent="submit">
      <AppAlert v-if="auth.error || error" :message="auth.error || error" />
      <FormField label="E-mail">
        <input v-model="email" type="email" autocomplete="email" required />
      </FormField>
      <button class="button primary" type="submit" :disabled="auth.loading">Envoyer le lien</button>
    </form>
  </main>
</template>
