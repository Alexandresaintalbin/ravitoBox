<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppDisclaimer from '@/components/AppDisclaimer.vue'
import AppHeader from '@/components/AppHeader.vue'
</script>

<template>
  <AppHeader guest />
  <main id="contenu" class="shell">
    <section class="hero">
      <div>
        <p class="muted">Sports d’endurance</p>
        <h1>La box qui prépare votre ravitaillement.</h1>
        <p class="lede">
          ravitoBox calcule glucides, eau et sodium à partir de votre profil, de vos produits et de la sortie prévue,
          puis pose un plan minute par minute. Course, trail, vélo ou triathlon.
        </p>
        <div class="row">
          <RouterLink class="button primary" to="/inscription">Créer mon compte</RouterLink>
          <RouterLink class="button ghost" to="/connexion">J’ai déjà un compte</RouterLink>
        </div>
      </div>
      <aside class="card stack">
        <h2>Trois allures</h2>
        <p>On teste à l’entraînement, on ajuste en course intermédiaire, on sécurise le jour de l’objectif.</p>
        <p class="muted">Votre estomac a le dernier mot : le gut training propose, vous confirmez.</p>
      </aside>
    </section>
    <AppDisclaimer />
    <section class="grid cards">
      <article class="card"><h3>La Box</h3><p>Centralisez gels, boissons, barres et eau, avec le stock réel.</p></article>
      <article class="card"><h3>Le plan</h3><p>Une prise à la fois, des cumuls lisibles, une liste de courses.</p></article>
      <article class="card"><h3>Le débrief</h3><p>Énergie, estomac, soif : les retours restent visibles avant d’être repris.</p></article>
    </section>
  </main>
</template>
