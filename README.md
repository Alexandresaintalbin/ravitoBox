# ravitoBox

ravitoBox prépare une stratégie de ravitaillement pour la course à pied, le trail, le cyclisme et le triathlon. À partir du profil, des produits réellement disponibles et des caractéristiques de la sortie, l’application estime les glucides, l’eau et le sodium, puis construit un plan minute par minute.

Les repères sont indicatifs. Ils ne remplacent pas l’avis d’un diététicien du sport et doivent être testés à l’entraînement avant une course.

## Démarrage

```bash
cp .env.example .env
docker compose up -d --build
```

- Application : http://localhost:8080
- API Supabase (Kong) : http://localhost:8000
- Courriels de développement (Mailpit) : http://localhost:8025
- Studio : http://localhost:54323

Le premier démarrage télécharge les images, applique les migrations et charge une vingtaine de produits génériques. Aucune valeur n’est attribuée à une marque réelle : vérifiez toujours l’étiquette.

Hot reload :

```bash
docker compose --profile dev up --build dev
```

L’interface de développement est alors sur http://localhost:5173.

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
| `make admin EMAIL=vous@exemple.fr` | Promeut un compte confirmé au rôle admin |
| `make secrets` | Affiche de nouveaux secrets à coller dans `.env` |

Les valeurs de `.env.example` sont les clés de démonstration publiques de l’exemple officiel Supabase. Elles conviennent au poste local. Pour un déploiement, générez-en de nouvelles avec `make secrets`, recopiez-les dans `.env`, puis recréez les volumes (`make reset-db`) : Postgres ne change pas les mots de passe déjà initialisés.

## Premier compte administrateur

1. Créez un compte dans l’application et confirmez l’e-mail via Mailpit.
2. `make admin EMAIL=vous@exemple.fr`
3. Rechargez la session : le lien Catalogue apparaît.

Le rôle est stocké dans `profiles.role`. Un déclencheur refuse qu’un utilisateur le modifie lui-même, y compris via l’API.

## Architecture

Le navigateur parle à une image nginx qui sert le build Vite. Au démarrage, l’entrypoint écrit `/config.js` à partir des variables d’environnement : la même image sert en local et en production, sans y graver l’URL ni la clé anon.

Kong expose Auth (GoTrue) et PostgREST. Postgres porte le schéma, les politiques RLS et le seed. Studio et postgres-meta sont là pour inspecter la base. Mailpit capture les courriels de confirmation et de réinitialisation.

```text
navigateur → nginx (web) → config.js
navigateur → Kong → GoTrue / PostgREST → Postgres
GoTrue → Mailpit
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

Un compte ne lit et n’écrit que ses lignes. Le catalogue est lisible par tout utilisateur connecté et modifiable seulement par un admin. La suppression du compte efface `auth.users` et, par cascade, le reste. L’export JSON reprend le profil, les produits privés, la Box, les favoris, les plans, les débriefs et les badges.

## Hypothèses nutritionnelles

Les fourchettes suivent des ordres de grandeur publiés, pas une prescription :

- Glucides : environ 0–30 g/h sous 1 h, 30–60 g/h entre 1 et 2 h, 60–90 g/h au-delà (Jeukendrup 2014, position de l’ISSN). Plafond : la tolérance saisie, sauf confirmation explicite.
- Le cyclisme reçoit un facteur supérieur à la course à pied. Le trail est un peu en dessous, avec une heuristique de +2 % par 500 m de dénivelé, plafonnée.
- Entraînement : haut de fourchette. Course intermédiaire : milieu. Objectif principal : bas de fourchette.
- Eau : environ 400–800 ml/h selon la chaleur et la sudation (ordre de grandeur ACSM).
- Sodium : environ 300–800 mg/h sur les mêmes axes.
- En triathlon, rien n’est planifié à la nage ni dans les transitions. Le vélo porte un débit plus haut, la course à pied un débit plus bas, pour une moyenne égale à la cible horaire.
- Gut training : +5 g/h si l’estomac a bien réagi, +10 g/h s’il a très bien réagi, −10 g/h sinon. La proposition est affichée ; elle n’est jamais appliquée seule.

Le poids est conservé dans le profil pour le suivi de l’athlète. Les fourchettes horaires ci-dessus ne sont pas recalculées au kilo, afin de rester dans les repères donnés.

## Modifier le calcul

Éditez uniquement `src/engine/config.ts`, puis relancez `npm run test:coverage`. Les tests du moteur vérifient les fourchettes, les sports, les types de sortie, le climat, la tolérance et les formats de triathlon.

## Déploiement de l’image

```bash
docker build --target web -t ravitobox:latest .
docker run --rm -p 8080:8080 \
  -e SUPABASE_URL=https://projet.supabase.co \
  -e SUPABASE_ANON_KEY=clé_anon_publique \
  ravitobox:latest
```

Seule la clé anon est lue par le navigateur. La clé service role reste sur la machine qui administre la base. L’image finale tourne avec l’utilisateur nginx, réécrit les routes de la SPA vers `index.html`, compresse les réponses, met en cache les assets et n’écrit `config.js` qu’au démarrage.

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
