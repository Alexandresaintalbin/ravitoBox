<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/AppAlert.vue'
import FormField from '@/components/FormField.vue'
import { downloadJson } from '@/lib/download'
import { FLAVORS } from '@/lib/flavors'
import { sportLabels } from '@/lib/labels'
import { emailChangeSchema, passwordPairSchema } from '@/schemas/auth'
import { deleteAccountSchema } from '@/schemas/debrief'
import { profileSchema } from '@/schemas/profile'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const notice = ref('')
const profileError = ref('')
const email = ref('')
const passwords = reactive({ password: '', confirm: '' })
const deletion = ref('')
const profile = reactive({
  pseudo: auth.profile?.pseudo ?? '',
  weightKg: auth.profile?.weightKg ?? null,
  primarySport: auth.profile?.primarySport ?? null,
  toleranceGPerHour: auth.profile?.toleranceGPerHour ?? 60,
  preferredFlavors: [...(auth.profile?.preferredFlavors ?? [])],
})

function toggleFlavor(flavor: string) {
  profile.preferredFlavors = profile.preferredFlavors.includes(flavor as never)
    ? profile.preferredFlavors.filter((item) => item !== flavor)
    : [...profile.preferredFlavors, flavor as (typeof profile.preferredFlavors)[number]]
}

async function saveProfile() {
  profileError.value = ''
  const parsed = profileSchema.safeParse({
    ...profile,
    weightKg: profile.weightKg === null || Number.isNaN(profile.weightKg) ? null : profile.weightKg,
    preferredFlavors: profile.preferredFlavors.filter((flavor) => (FLAVORS as readonly string[]).includes(flavor)),
  })
  if (!parsed.success) {
    profileError.value = parsed.error.issues[0]?.message ?? 'Profil invalide.'
    return
  }
  try {
    await auth.updateProfile(parsed.data)
    notice.value = 'Profil mis à jour.'
  } catch {
    notice.value = ''
  }
}

async function changeEmail() {
  const parsed = emailChangeSchema.safeParse({ email: email.value })
  if (!parsed.success) return
  await auth.updateEmail(parsed.data)
  notice.value = 'Un e-mail de confirmation a été envoyé à la nouvelle adresse.'
}

async function changePassword() {
  const parsed = passwordPairSchema.safeParse(passwords)
  if (!parsed.success) return
  await auth.updatePassword(parsed.data)
  notice.value = 'Mot de passe modifié.'
}

async function exportData() {
  const data = await auth.exportData()
  downloadJson('ravitobox-donnees.json', data)
}

async function removeAccount() {
  const parsed = deleteAccountSchema.safeParse({ confirmation: deletion.value })
  if (!parsed.success) return
  await auth.deleteAccount()
  await router.push('/')
}
</script>

<template>
  <section class="stack">
    <h1>Mon compte</h1>
    <AppAlert v-if="notice" kind="ok" :message="notice" />
    <AppAlert v-if="auth.error || profileError" :message="auth.error || profileError" />
    <form class="card stack" @submit.prevent="saveProfile">
      <h2>Profil</h2>
      <FormField label="Pseudo"><input v-model="profile.pseudo" required /></FormField>
      <FormField label="Poids (kg, facultatif)"><input v-model.number="profile.weightKg" type="number" min="0" step="0.1" /></FormField>
      <FormField label="Sport principal">
        <select v-model="profile.primarySport">
          <option :value="null">Non précisé</option>
          <option v-for="(label, key) in sportLabels" :key="key" :value="key">{{ label }}</option>
        </select>
      </FormField>
      <FormField label="Tolérance digestive par défaut (g/h)">
        <input v-model.number="profile.toleranceGPerHour" type="number" min="0" max="200" />
      </FormField>
      <fieldset>
        <legend>Goûts préférés</legend>
        <label v-for="flavor in FLAVORS" :key="flavor" class="row">
          <input type="checkbox" :checked="profile.preferredFlavors.includes(flavor)" @change="toggleFlavor(flavor)" />
          {{ flavor }}
        </label>
      </fieldset>
      <button class="button primary" type="submit">Enregistrer le profil</button>
    </form>
    <form class="card stack" @submit.prevent="changeEmail">
      <h2>Changer l’e-mail</h2>
      <FormField label="Nouvelle adresse"><input v-model="email" type="email" required /></FormField>
      <button class="button ghost" type="submit">Mettre à jour l’e-mail</button>
    </form>
    <form class="card stack" @submit.prevent="changePassword">
      <h2>Changer le mot de passe</h2>
      <FormField label="Nouveau mot de passe"><input v-model="passwords.password" type="password" required /></FormField>
      <FormField label="Confirmation"><input v-model="passwords.confirm" type="password" required /></FormField>
      <button class="button ghost" type="submit">Mettre à jour le mot de passe</button>
    </form>
    <section class="card stack">
      <h2>Vos données</h2>
      <button class="button ghost" type="button" @click="exportData">Exporter mes données (JSON)</button>
    </section>
    <form class="card stack" @submit.prevent="removeAccount">
      <h2>Supprimer le compte</h2>
      <p>Cette action efface le profil, la Box, les plans et les débriefs. Saisissez SUPPRIMER pour confirmer.</p>
      <FormField label="Confirmation"><input v-model="deletion" autocomplete="off" /></FormField>
      <button class="button warn" type="submit">Supprimer définitivement</button>
    </form>
  </section>
</template>
