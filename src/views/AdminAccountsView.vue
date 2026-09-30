<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import AppAlert from '@/components/AppAlert.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import FormField from '@/components/FormField.vue'
import { formatDate } from '@/lib/format'
import { useAccountsStore } from '@/stores/accounts'
import { useAuthStore } from '@/stores/auth'

const accounts = useAccountsStore()
const auth = useAuthStore()
const accountForm = reactive({ email: '', password: '', pseudo: '' })
const inviteForm = reactive({ note: '', maxUses: 1 })

onMounted(() => {
  void accounts.load().catch(() => undefined)
  void accounts.loadInvitations().catch(() => undefined)
})

async function createAccount() {
  try {
    await accounts.createAccount(accountForm)
    accountForm.email = ''
    accountForm.password = ''
    accountForm.pseudo = ''
  } catch {
    /* message dans le store */
  }
}

async function createInvitation() {
  try {
    await accounts.createInvitation(inviteForm.note, inviteForm.maxUses)
    inviteForm.note = ''
  } catch {
    /* message dans le store */
  }
}
</script>

<template>
  <section class="stack">
    <h1>Comptes</h1>
    <p class="muted">Création et désactivation sans passer par la clé d’administration du serveur.</p>
    <AppAlert v-if="accounts.error" :message="accounts.error" />
    <AppSpinner v-if="accounts.loading && accounts.accounts.length === 0" />
    <EmptyState v-else-if="accounts.accounts.length === 0" title="Aucun compte" text="Les profils apparaîtront ici." />
    <ul v-else class="stack">
      <li v-for="account in accounts.accounts" :key="account.id" class="card row">
        <div>
          <strong>{{ account.pseudo }}</strong>
          <p class="muted">{{ account.email }} · {{ account.role }} · {{ account.active ? 'actif' : 'désactivé' }} · {{ formatDate(account.createdAt) }}</p>
        </div>
        <button
          v-if="account.id !== auth.user?.id"
          class="button ghost"
          type="button"
          @click="accounts.setActive(account.id, !account.active)"
        >
          {{ account.active ? 'Désactiver' : 'Réactiver' }}
        </button>
      </li>
    </ul>

    <form class="card stack" @submit.prevent="createAccount">
      <h2>Créer un compte</h2>
      <FormField label="Pseudo"><input v-model="accountForm.pseudo" required /></FormField>
      <FormField label="E-mail"><input v-model="accountForm.email" type="email" required /></FormField>
      <FormField label="Mot de passe temporaire"><input v-model="accountForm.password" type="password" required minlength="8" /></FormField>
      <button class="button primary" type="submit" :disabled="accounts.loading">Créer</button>
    </form>

    <form class="card stack" @submit.prevent="createInvitation">
      <h2>Codes d’invitation</h2>
      <p class="muted">Utiles lorsque le mode d’inscription est « invite ». Un code désactivé ne peut plus être consommé.</p>
      <FormField label="Note"><input v-model="inviteForm.note" /></FormField>
      <FormField label="Nombre d’utilisations"><input v-model.number="inviteForm.maxUses" type="number" min="1" max="1000" /></FormField>
      <button class="button ghost" type="submit">Créer un code</button>
      <ul>
        <li v-for="invitation in accounts.invitations" :key="invitation.id" class="row">
          <code>{{ invitation.code }}</code>
          <span class="muted">{{ invitation.useCount }}/{{ invitation.maxUses }} · {{ invitation.active ? 'actif' : 'désactivé' }}</span>
          <button class="button ghost" type="button" @click="accounts.setInvitationActive(invitation.id, !invitation.active)">
            {{ invitation.active ? 'Désactiver' : 'Réactiver' }}
          </button>
        </li>
      </ul>
    </form>
  </section>
</template>
