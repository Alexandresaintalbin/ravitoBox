# ravitoBox

ravitoBox prépare une stratégie de ravitaillement pour la course à pied, le trail, le cyclisme et le triathlon. À partir du profil, des produits réellement disponibles et des caractéristiques de la sortie, l’application estime les glucides, l’eau et le sodium, puis construit un plan minute par minute.

Les repères sont indicatifs. Ils ne remplacent pas l’avis d’un diététicien du sport et doivent être testés à l’entraînement avant une course.

## Démarrage

```bash
cp .env.example .env
docker compose up -d --build
```

- Application : http://localhost:8080
- API (Kong, Auth et PostgREST) : http://localhost:8000

Le premier démarrage applique les migrations et charge une vingtaine de produits génériques, sans marque réelle. Le catalogue courant vient d’Open Food Facts : `make import-products`. Vérifiez toujours l’étiquette.

Studio (http://127.0.0.1:54323), Mailpit (http://127.0.0.1:8025) et Postgres (127.0.0.1:54322) écoutent uniquement sur la machine. Ils ne doivent jamais être publiés sur Internet, ni via un tunnel, ni via un reverse proxy.

Hot reload :

```bash
docker compose --profile dev up --build dev
```

L’interface de développement est alors sur http://localhost:5173.

## Inscriptions

Les inscriptions sont **fermées par défaut**. Un administrateur crée les comptes depuis la page Comptes, ou vous ouvrez une des deux autres politiques.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `SIGNUP_MODE` | `closed` | `closed` : personne ne s’inscrit. `invite` : un code d’invitation est exigé. `open` : inscription libre. |
| `DISABLE_SIGNUP` | `true` | Interrupteur GoTrue. `true` si le mode est `closed`, `false` si le mode est `invite` ou `open`. Le script de migration refuse une combinaison incohérente. |
| `ENABLE_EMAIL_SIGNUP` | `true` | Laisse l’authentification par e-mail activée. |
| `ENABLE_EMAIL_AUTOCONFIRM` | `false` | `true` : mode sans e-mail, le compte est actif dès l’inscription ou la création par un admin. `false` : l’e-mail de confirmation part (Mailpit en local). |

Après un changement, relancez la stack pour que GoTrue et `app_settings` prennent la même valeur. En mode `invite`, la page Comptes crée et désactive les codes. Un déclencheur SQL consomme le code au moment de l’insertion dans `auth.users` : l’API seule ne peut pas contourner la page.

## Comptes, suppression et administration

La clé `service_role` ne figure pas dans le frontend, ni dans une variable `VITE_`. Le navigateur n’envoie que la clé anon, via `config.js` produit au démarrage du conteneur.

Les opérations sensibles sont des fonctions Postgres `SECURITY DEFINER`, exécutées avec les droits du propriétaire de la fonction, après un contrôle `is_admin()` ou `auth.uid()` :

| Action | Fonction |
| --- | --- |
| Supprimer son propre compte, et toutes les données en cascade | `public.delete_own_account()` |
| Lister les comptes | `public.admin_list_accounts()` |
| Créer un compte déjà confirmé, même si les inscriptions sont fermées | `public.admin_create_account(email, mot de passe, pseudo)` |
| Désactiver ou réactiver un autre compte (`banned_until`) | `public.admin_set_account_active(id, actif)` |

Le rôle (`user` ou `admin`) n’est pas modifiable par l’utilisateur : un déclencheur `BEFORE UPDATE` rejette le changement. Le premier admin se nomme encore à la main, une fois le compte confirmé :

```bash
make admin EMAIL=vous@exemple.fr
```

Rechargez la session : les liens Catalogue et Comptes apparaissent.

## Commandes

| Commande | Effet |
| --- | --- |
| `make up` | Construit et démarre la stack |
| `make down` | Arrête les conteneurs |
| `make logs` | Suit les journaux |
| `make test` | Tests unitaires et couverture, sans rien installer sur la machine |
| `make test-integration` | Politiques RLS contre la base déjà démarrée |
| `make test-e2e` | Parcours Playwright |
| `make reset-db` | Supprime le volume Postgres et repart de zéro |
| `make backup` | Dump SQL horodaté dans `backups/` |
| `make restore FILE=backups/ravitobox-….sql` | Restaure ce dump (opération destructive) |
| `make admin EMAIL=vous@exemple.fr` | Promeut un compte confirmé au rôle admin |
| `make import-products` | Importe un échantillon Open Food Facts (`LIMIT=400` par défaut) |
| `make import-products DUMP=chemin.jsonl` | Même import depuis un export JSONL local, sans appel réseau |
| `make secrets` | Affiche de nouveaux secrets à coller dans `.env` |

Les valeurs de `.env.example` sont les clés de démonstration publiques de l’exemple officiel Supabase. Elles conviennent au poste local. Pour un déploiement, générez-en de nouvelles avec `make secrets`, recopiez-les dans `.env`, puis recréez les volumes (`make reset-db`) : Postgres ne change pas les mots de passe déjà initialisés.

## Architecture

Le navigateur parle à une image nginx qui sert le build Vite. Au démarrage, l’entrypoint écrit `/config.js` à partir des variables d’environnement : la même image sert en local et en production, sans y graver l’URL ni la clé anon.

Kong expose seulement Auth (GoTrue) et PostgREST. Postgres porte le schéma, les politiques RLS et le seed. Studio et postgres-meta servent à inspecter la base sur la machine. Mailpit capture les courriels de confirmation et de réinitialisation, lui aussi en local.

```text
navigateur → nginx (web) → config.js
navigateur → Kong → GoTrue / PostgREST → Postgres
GoTrue → Mailpit   (réseau Docker, pas Internet)
```

Le calcul nutritionnel et le planificateur sont des fonctions pures dans `src/engine`. Ils ne dépendent ni de Vue ni de Supabase. Tous les seuils sont dans `src/engine/config.ts`.

## Schéma

| Table | Rôle |
| --- | --- |
| `profiles` | Pseudo, poids facultatif, sport, tolérance, goûts, rôle |
| `products` | Catalogue commun (`owner_id` nul) ou produit privé |
| `box_items` | Stock et exclusion |
| `favorites` | Produits marqués |
| `plans` | Paramètres, cibles et plan généré |
| `debriefs` | Sensations et consommation réelle |
| `badges`, `user_badges` | Médailles de progression |
| `invitations` | Codes d’invitation, usages et désactivation |
| `app_settings` | Mode d’inscription et confirmation e-mail, lus par les fonctions SQL |

Un compte ne lit et n’écrit que ses lignes. Le catalogue est lisible par tout utilisateur connecté et modifiable seulement par un admin. La suppression du compte efface `auth.users` et, par cascade, le reste. L’export JSON reprend le profil, les produits privés, la Box, les favoris, les plans, les débriefs et les badges. Toutes les tables `public` ont le RLS activé ; un test de migration et, quand la base tourne, `tables_without_rls()` le vérifient.

## Ce qui peut être publié

Publiez l’application (port 8080) et, si le navigateur doit joindre Supabase sur un autre nom d’hôte, l’API Kong (port 8000). Ne publiez pas Studio, Mailpit, postgres-meta ni le port Postgres : ils sont liés à `127.0.0.1` dans Compose pour cette raison.

## Hypothèses nutritionnelles

Les fourchettes suivent des ordres de grandeur publiés, pas une prescription :

- Glucides : environ 0–30 g/h sous 1 h, 30–60 g/h entre 1 et 2 h, 60–90 g/h au-delà (Jeukendrup 2014, position de l’ISSN). Plafond : la tolérance saisie, sauf confirmation explicite.
- Le cyclisme reçoit un facteur supérieur à la course à pied. Le trail est un peu en dessous, avec une heuristique de +2 % par 500 m de dénivelé, plafonnée.
- Entraînement : haut de fourchette. Course intermédiaire : milieu. Objectif principal : bas de fourchette.
- Eau : environ 400–800 ml/h selon la chaleur et la sudation. Les recommandations de l’ACSM sont individualisées (pesée, soif, conditions). Cette fourchette est un ordre de grandeur courant, à valider pour la personne, pas une cible ACSM personnalisée.
- Sodium : environ 300–800 mg/h sur les mêmes axes, avec la même réserve.
- En triathlon, rien n’est planifié à la nage ni dans les transitions. Le vélo porte un débit plus haut, la course à pied un débit plus bas, pour une moyenne égale à la cible horaire.
- Gut training : +5 g/h si l’estomac a bien réagi, +10 g/h s’il a très bien réagi, −10 g/h sinon. La proposition est affichée ; elle n’est jamais appliquée seule.

Le poids est conservé dans le profil pour le suivi de l’athlète. Les fourchettes horaires ci-dessus ne sont pas recalculées au kilo, afin de rester dans les repères donnés.

## Modifier le calcul

Éditez uniquement `src/engine/config.ts`, puis relancez `npm run test:coverage`. Les tests du moteur vérifient les fourchettes, les sports, les types de sortie, le climat, la tolérance et les formats de triathlon.

## Catalogue Open Food Facts

Données : [Open Food Facts](https://world.openfoodfacts.org/) ([licence ODbL](https://opendatacommons.org/licenses/odbl/1-0/)). Images : contributeurs Open Food Facts ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)). La même mention est dans le pied de page et sur chaque fiche.

`make import-products` interroge l’API de recherche avec un User-Agent `ravitoBox`, une pause d’une seconde et un cache dans `.cache/off/`. Pour un import massif, téléchargez l’[export ouvert](https://world.openfoodfacts.org/data) au format JSONL et lancez `make import-products DUMP=chemin.jsonl`. Les marques ciblées sont dans `scripts/import-products/brands.txt`, les catégories dans `scripts/import-products/categories.txt`.

L’import est idempotent sur le code-barres. Un produit marqué vérifié n’est jamais écrasé. Le rapport final compte les ajouts, les mises à jour, les ignorés et les rejets (portion inconnue, glucides absents, valeur aberrante, hors France, hors marques). Aucune valeur manquante n’est remplacée par zéro : le sodium, la caféine ou la portion absents restent nuls, et la fiche est `incomplete`. Les glucides supérieurs à la masse de la portion sont rejetés. Le sel est converti en sodium (sodium = sel / 2,5) seulement quand le sodium n’est pas déjà renseigné.

Pendant l’import, `sharp` télécharge l’image, la convertit en WebP (vignette et détail) et l’envoie dans le bucket Storage `product-images`. À l’exécution, le navigateur ne charge aucune image externe : nginx sert `/storage/` depuis Kong. Sans image, une icône du type de produit s’affiche.

La page Catalogue pagine côté serveur (`pg_trgm` sur le nom et la marque). La fiche rappelle de vérifier l’étiquette, montre les valeurs par portion et pour 100 g/ml, et propose un lien Open Food Facts. « Où l’acheter » est un lien et un prix saisis à la main : pas de paiement, pas d’affiliation, pas de prix récupéré.

Un utilisateur qui corrige un produit du catalogue crée une copie privée. L’admin la voit dans « À vérifier », peut la promouvoir, marquer une fiche comme vérifiée, ou fusionner deux doublons (même code-barres, ou même nom et même marque). Le plan ignore un produit dont les glucides sont inconnus. S’il utilise un produit non vérifié, ou dont le sodium ou la caféine sont inconnus, il l’affiche dans les avertissements et compte l’inconnu comme zéro, sans inventer la valeur.

Les photos personnelles (JPEG, PNG ou WebP, 2 Mo, type vérifié sur les octets) vont dans `users/{id}/`. Seul ce compte peut les remplacer ou les supprimer. Seul un admin écrit dans `catalog/`.

## Coûts

Tout le socle utilisé ici est gratuit, y compris pour un usage personnel auto-hébergé.

| Composant | Licence | Coût |
| --- | --- | --- |
| ravitoBox (ce dépôt) | code du projet | 0 € |
| Vue, Vue Router, Pinia, Vite, Zod, Supabase JS | MIT | 0 € |
| PostgreSQL | PostgreSQL License | 0 € |
| PostgREST | MIT | 0 € |
| GoTrue | MIT | 0 € |
| Kong (passerelle) | Apache 2.0 | 0 € |
| Studio et postgres-meta | Apache 2.0 | 0 € |
| nginx | BSD-2-Clause | 0 € |
| Mailpit | MIT | 0 € |
| Open Food Facts (données) | ODbL | 0 € |
| Images Open Food Facts | CC BY-SA 4.0 | 0 € |
| sharp | Apache 2.0 | 0 € |
| pg_trgm (PostgreSQL) | PostgreSQL License | 0 € |
| Supabase Storage (auto-hébergé) | Apache 2.0 | 0 € |
| Tailscale, Cloudflare Tunnel | offres gratuites des éditeurs, avec leurs plafonds | 0 € tant que l’on reste dans le palier gratuit |

Un nom de domaine, une machine virtuelle ou un dépassement de palier cloud sont les seuls coûts éventuels. Ils ne sont pas exigés pour faire tourner ravitoBox.

## Déploiement gratuit

**Sur la machine.** `docker compose up` suffit. L’application et l’API sont joignables en local. Studio, Mailpit et Postgres restent sur `127.0.0.1`.

**Tailscale.** Installez Tailscale sur l’hôte et sur le téléphone ou l’ordinateur distant. N’exposez pas de port sur Internet : les appareils du tailnet ouvrent `http://nom-de-la-machine:8080`. Si l’API est sur un autre port, limitez-la au tailnet également (`http://nom-de-la-machine:8000`) et réglez `SUPABASE_URL` en conséquence. Ne faites pas pointer Tailscale vers 54323, 8025 ou 54322.

**Cloudflare Tunnel.** `cloudflared` peut publier uniquement le port 8080, et le port 8000 si le navigateur doit appeler l’API sur un second nom d’hôte. Le palier gratuit convient à un usage personnel ; il ne garantit pas un débit ni une disponibilité de production. Ne créez pas de tunnel vers Studio, Mailpit ou Postgres.

**Autres options cloud, et leurs limites.**

- Une instance Supabase gratuite peut remplacer la base auto-hébergée : le projet se met en pause après une semaine d’inactivité, l’espace et la bande passante sont plafonnés, et la clé service role ne doit toujours pas sortir du serveur.
- Un petit VPS (souvent un palier d’essai ou un crédit initial) fait tourner Compose. Au-delà de l’essai, la machine se paie. Ouvrez seulement 80/443 vers nginx, et l’API si elle n’est pas sur le même origine.
- Fly.io, Render ou Railway ont des paliers gratuits qui s’endorment, limitent la RAM ou facturent le dépassement. L’image `web` seule s’y déploie ; la base reste un Postgres que vous contrôlez.

## Déploiement de l’image

L’image `web` ne contient ni l’URL ni les clés. Elle les reçoit au démarrage.

Avec la stack auto-hébergée de ce dépôt, sur le même hôte :

```bash
docker compose up -d --build
```

Le service `web` reçoit `SUPABASE_URL` et `SUPABASE_ANON_KEY` depuis `.env`. C’est le mode prévu : nginx, Kong, GoTrue, PostgREST et Postgres restent dans le réseau Docker. Seuls les ports de l’application et de l’API sont destinés à être atteints par un navigateur.

Pour pointer cette même image vers une autre API (Supabase hébergé ou une autre machine), sans embarquer la stack :

```bash
docker build --target web -t ravitobox:latest .
docker run --rm -p 8080:8080 \
  -e SUPABASE_URL=https://projet.exemple \
  -e SUPABASE_ANON_KEY=clé_anon_publique \
  ravitobox:latest
```

Seule la clé anon est lue par le navigateur. La clé service role reste dans `.env` sur la machine qui administre Postgres, jamais dans le build. L’image finale tourne avec l’utilisateur nginx, réécrit les routes de la SPA vers `index.html`, compresse les réponses, met en cache les assets et n’écrit `config.js` qu’au démarrage.

## Tests

```bash
npm test
npm run test:coverage
npm run test:integration   # stack déjà démarrée
npm run test:e2e
```

La couverture exigée est de 100 % sur `src/engine`, au moins 90 % de lignes et de branches sur les schémas, stores, composables et bibliothèques, et au moins 80 % global. Le workflow GitHub Actions enchaîne lint, typecheck, couverture et build.

## Avertissement

ravitoBox ne connaît ni votre sudation réelle, ni vos antécédents, ni la composition exacte de vos produits. Faites valider la stratégie par un professionnel et répétez-la à l’entraînement avant de l’utiliser le jour d’une course.
