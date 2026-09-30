<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import AppAlert from '@/components/AppAlert.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import FormField from '@/components/FormField.vue'
import { signupSchemaFor } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth'
import { type SignupPolicy } from '@/stores/accounts'

const auth = useAuthStore()
const policy = ref<SignupPolicy>({ mode: 'closed', emailConfirmation: true })
const ready = ref(false)
const form = reactive({ email: '', password: '', pseudo: '', invitationCode: '' })
const errors = ref<Record<string, string>>({})
const done = ref<'email' | 'ready' | null>(null)

onMounted(async () => {
  try {
    policy.value = await auth.loadSignupPolicy()
  } catch {
    policy.value = { mode: 'closed', emailConfirmation: true }
  } finally {
    ready.value = true
  }
})

async function submit() {
  errors.value = {}
  const parsed = signupSchemaFor(policy.value.mode).safeParse(form)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.value[String(issue.path[0])] = issue.message
    return
  }
  try {
    const result = await auth.signUp(parsed.data)
    done.value = result.needsConfirmation ? 'email' : 'ready'
  } catch {
    done.value = null
  }
}
</script>

<template>
  <AppHeader guest />
  <main id="contenu" class="shell stack">
    <h1>Créer un compte</h1>
    <AppSpinner v-if="!ready" />
    <AppAlert
      v-else-if="policy.mode === 'closed'"
      message="Les inscriptions sont fermées. Demandez un compte à un administrateur."
    />
    <AppAlert v-else-if="done === 'email'" kind="ok" message="Un e-mail de confirmation vient de partir. Ouvrez-le pour activer le compte." />
    <AppAlert v-else-if="done === 'ready'" kind="ok" message="Le compte est actif. Vous pouvez vous connecter, sans attendre d’e-mail." />
    <form v-else class="card stack" @submit.prevent="submit">
      <AppAlert v-if="auth.error" :message="auth.error" />
      <FormField v-if="policy.mode === 'invite'" label="Code d’invitation" :error="errors.invitationCode">
        <input v-model="form.invitationCode" autocomplete="off" required :aria-invalid="Boolean(errors.invitationCode)" />
      </FormField>
      <FormField label="Pseudo" :error="errors.pseudo">
        <input v-model="form.pseudo" autocomplete="nickname" required :aria-invalid="Boolean(errors.pseudo)" />
      </FormField>
      <FormField label="E-mail" :error="errors.email">
        <input v-model="form.email" type="email" autocomplete="email" required :aria-invalid="Boolean(errors.email)" />
      </FormField>
      <FormField label="Mot de passe" :error="errors.password" hint="8 caractères minimum.">
        <input v-model="form.password" type="password" autocomplete="new-password" required :aria-invalid="Boolean(errors.password)" />
      </FormField>
      <p v-if="!policy.emailConfirmation" class="muted">La confirmation par e-mail est désactivée sur cette instance.</p>
      <button class="button primary" type="submit" :disabled="auth.loading">Créer le compte</button>
    </form>
  </main>
</template>
