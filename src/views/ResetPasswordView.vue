<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import AppHeader from '@/components/AppHeader.vue'
import FormField from '@/components/FormField.vue'
import { passwordPairSchema } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const form = reactive({ password: '', confirm: '' })
const error = ref('')

async function submit() {
  error.value = ''
  const parsed = passwordPairSchema.safeParse(form)
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Mot de passe invalide.'
    return
  }
  try {
    await auth.updatePassword(parsed.data)
    await router.push('/app')
  } catch {
    error.value = auth.error ?? 'Impossible de mettre à jour le mot de passe.'
  }
}
</script>

<template>
  <AppHeader />
  <main id="contenu" class="shell stack">
    <h1>Nouveau mot de passe</h1>
    <form class="card stack" @submit.prevent="submit">
      <AppAlert v-if="error" :message="error" />
      <FormField label="Nouveau mot de passe">
        <input v-model="form.password" type="password" autocomplete="new-password" required />
      </FormField>
      <FormField label="Confirmation">
        <input v-model="form.confirm" type="password" autocomplete="new-password" required />
      </FormField>
      <button class="button primary" type="submit" :disabled="auth.loading">Enregistrer</button>
    </form>
  </main>
</template>
