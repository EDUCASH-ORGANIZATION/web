# EduCash Web PWA - Consignes pour les agents

Marketplace étudiants / clients au Bénin. Site en refonte "Direction A" : lire `REDESIGN.md` avant tout travail d'interface.

## Stack
- Next 16.2 (App Router, Turbopack), React 19, Tailwind 4 (`@tailwindcss/postcss`), JavaScript uniquement (pas de `.ts` ni `.tsx`).
- MUI et Emotion : retirés du projet (RD-02). Ne pas les réintroduire.
- Supabase (`@supabase/ssr`), FedaPay (jamais nommé dans les textes visibles de la vitrine), Resend, next-pwa. Déploiement Vercel.
- Alias `@/` pour tous les imports. Server Components par défaut, `"use client"` seulement si nécessaire.
- Formulaires : react-hook-form + zod. Commandes : `npm run dev`, `npm run build`, `npx eslint <fichiers>`.
- Tests : Vitest, `npm test` (fichiers `src/**/*.test.{js,jsx}`, environnement node, config `vitest.config.mjs`).
- Ne jamais commiter `public/sw.js` ni `public/workbox-*.js` (générés par next-pwa au build).

## Design system (Direction A)
- Emplacement : `src/app/design/{tokens,components,layouts}.css`, importés par `src/app/globals.css`. Copie des maquettes `design-rebrand/maquettes/_system/` : ne pas le modifier hors d'une tâche dédiée.
- Couches : `tokens.css` dans `theme`, `components.css` et `layouts.css` dans `components` (reset dans la couche `base` imbriquée). 
- `.ds` ne porte que les styles de racine (police Figtree, couleur encre, fond givre). Le reset et les sélecteurs de composants sont globaux, dans la couche `components` : les utilitaires Tailwind gardent la priorité, mais un nom de classe du système utilisé hors `.ds` est stylé. Ne jamais réutiliser un nom de classe du système dans un écran Tailwind. Avant d'ajouter une classe au système, vérifier par grep qu'elle n'existe pas déjà dans le code ancien ; sinon la préfixer `ds-`.
- On consomme le système par ses classes (`.btn`, `.card`, `.badge`, `.field`, `.shell`...) et par `<Icon name="i-..." className="ic" />` (`src/components/design/icon.jsx`).
- Anti-collision avec Tailwind : les classes qui portent un nom d'utilitaire sont préfixées `ds-` : `ds-grid`, `ds-container`, `ds-grow`, `ds-table`, `ds-table-wrap`, `ds-h1` à `ds-h4`, `ds-pulse`, `ds-strong`, `ds-scrim-fixed`. `sr-only` vient de Tailwind.
- Select : `<Select>` (`src/components/design/select.jsx`, logique pure dans `select-logic.js`) remplace le `<select>` natif dans la vitrine (variantes `chip`, `bare`, `field`). Classes `ds-select`, `ds-select--*`, `ds-select__bare`, `ds-select__menu`, liste = `.menu` du système. Les espaces connectés gardent le `<select>` natif jusqu'à leur refonte.
- Responsive : breakpoints 1024, 768 et 480 (media queries dans `tokens.css` et `layouts.css`). Classes `ds-desk-only` et `ds-mob-only` pour afficher selon la taille. Exception : l'en-tête vitrine a son propre seuil à 1360 px (navigation dans le burger entre 1024 et 1359 px, voir `layouts.css`).
- Titres Anton : interligne via `--lh-display` (1.14 minimum, accents des majuscules), sauf chiffres sans accents.
- Logos d'opérateurs dans `public/logos/operators/`, affichés via `OperatorLogo` (`src/components/vitrine/shared/`).
- Couleurs en dur interdites : uniquement `var(--c-*)`. Pas de `style={{}}`, pas de `<style>` local.
- Palette : bleu `#2F3BED`, citron `#C8F03C` (jamais en texte sur fond clair), encre `#0E0F1A`, givre `--c-givre`.
- Polices via `next/font` dans `layout.js` : variables `--font-anton`, `--font-figtree`, `--font-inter`, branchées sur `--f-display` (Anton) et `--f-text` (Figtree). Inter reste pour les espaces connectés pas encore refondus. Pas d'`@import` Google Fonts.
- Icônes : sprite externe `public/sprite.svg`, référencé avec `?v=` (`SPRITE_VERSION`). Incrémenter la version si le sprite change.
- Logo final et icônes PWA dans `public/`. Le `manifest.json` utilise `#2F3BED`.
- Texte secondaire : `--c-ardoise` sur clair, `--c-brume` sur encre, blanc sur bleu ; taille `--t-para` (16 px, 15 px sous 768) ; jamais d'opacité sur du texte ; `--t-micro` (13 px) est le minimum absolu. Écart assumé avec maquettes/_system (RD-FIX-03).
- Ne JAMAIS utiliser une classe Tailwind dont le nom existe dans le système de design (exemple : oublier le préfixe de `ds-grow`, erreur déjà commise). Tailwind ne génère que les classes présentes dans le code : une classe absente du code n'existe pas au build.

## Cohabitation pendant la transition
- Les espaces connectés (`(student)`, `(client)`, `(admin)`, `legal/*`) restent en Tailwind avec parité stricte avec `main`. Ne pas les toucher sauf portage complet d'un écran.
- L'authentification (`/auth/*`) est refondue sur le design system (RD-02) ; plus aucune page MUI.
- Règle pour tout nouvel écran : uniquement les classes du système sous une racine `.ds`, en reprenant la maquette de `/Users/brandonmedehou/Desktop/EDUCASH/design-rebrand/maquettes/`. Pas de Tailwind dans un écran refondu.
- Exception tolérée : utilitaires Tailwind de dimension et de forme (w-*, h-*, max-w-*, rounded-full, object-cover) pour les squelettes de chargement et les images d'avatar, tant que le système ne fournit pas d'équivalent. Aucune couleur, aucun espacement de mise en page en Tailwind dans un écran refondu.
- UX : l'étudiant est tutoyé, le client vouvoyé, l'admin se tutoie entre collègues. Deux publics seulement : les clients (familles, salariés, fonctionnaires, entreprises : même compte) sur `/`, les étudiants sur `/etudiants`. Pas de page ni de bloc « Entreprises ».

## Routes cibles (décision 14 de INVENTAIRE.md)
- Espace étudiant entièrement sous `/student/...` (`/dashboard`, `/applications`, `/messages`, `/wallet`, `/profile` y déménagent, avec redirections depuis les anciennes URL).
- Profil public étudiant : `/talents/[id]` (remplace `/students/[id]`).
- Nouvelles pages publiques en français : `/etudiants` et `/aide`. `/clients` n'existe plus : `middleware.js` le redirige en 308 vers `/` (l'accueil parle aux clients).
- Espace client sous `/client/...`, espace admin sous `/admin/...`.

## Vitrine
- Éditeur légal : BRANDYBEN (entreprise individuelle), données dans `src/components/vitrine/legal/legal-entity.js`. Ne jamais écrire « EduCash SAS ».
- Pas de `loading.js` dans un segment qui appelle `notFound()`, sinon le statut devient 200 au lieu de 404.
- Mots bannis dans les textes vitrine, légaux et emails : « livraison », « course(s) », « coursier(s) », « saisie », « Bientôt » (opérateurs), et le nom du prestataire de paiement (« notre prestataire de paiement agréé »). « Commission » est réservé aux 12 %. Garde-fous : `vitrine-content.guard.test.js`, `vocabulary.render.test.jsx`.

## Variables d'environnement
- `CONTACT_INBOX_EMAIL` : destinataire du formulaire de contact (défaut `contact@educash.bj`). Les autres variables restent dans `.env.local`, jamais lu ni commité.

## Rôles
- `student`, `client` et `admin`. `middleware.js` redirige encore selon `user_metadata.role` (navigation seulement).
- `user_metadata` est modifiable par l'utilisateur : ne s'en servir que pour l'affichage ou la navigation, jamais pour une autorisation. Toute autorisation lit `profiles.role` côté serveur via `getServerRole(supabase, user)` (`src/lib/auth/server-role.js`) : le repli sur `user_metadata` est limité à student et client, jamais admin. La garde admin (layout et `assertAdmin`) exige `profiles.role = 'admin'`.
- Dette connue : le middleware, les layouts étudiant et client et les autres server actions s'appuient encore sur `user_metadata`. Lot dédié RD-SEC-01.
- L'admin ne peut jamais être auto-attribué (ni à l'inscription ni par mise à jour de profil). Un étudiant ne peut pas s'auto-vérifier. Les onboardings écrivent une liste blanche de colonnes (jamais `role`, `is_verified`, `is_suspended`, `verified_until`).

## Authentification
- Formulaires d'auth : action serveur (`useActionState`) ou `method="post"`, bouton `HydratedSubmit` inactif avant hydratation. Jamais de GET portant des identifiants.
- Cookies httpOnly `ec_pending_email` (adresse rappelée sur la page de vérification) et `ec_recovery` (autorise le nouveau mot de passe). Jamais d'email ni de mot de passe dans une URL.
- `next` toujours validé par `safeNextPath` et `isNextAllowedForRole`. Destinations dans `src/lib/auth/destinations.js`, schémas zod dans `src/lib/auth/schemas.js` (téléphone béninois 10 chiffres commençant par 01, stocké `+22901XXXXXXXX`).
- Aucune durée de validité de lien ni délai d'examen de carte affichés. Garde-fous : `vitrine-content.guard.test.js` (auth incluse) et `auth-emails.guard.test.js`.

## Données
- Accès aux données uniquement via `src/lib/actions` (server actions) et `src/lib/supabase/{client,server}.js`. Pas de couche `services` séparée.
- Une migration de Supabase vers **Neon** est prévue. Ne pas investir dans du nouveau SQL, des politiques RLS ou des Edge Functions spécifiques à Supabase, et garder l'accès aux données isolé dans `src/lib/actions` pour faciliter le changement.

## Métier
- Commission EduCash 12 % : `COMMISSION_RATE` et `netAmount()` dans `src/lib/constants/missions.js` (valeurs de `src/lib/supabase/database.constants.js`). Ne jamais écrire 0.12 en dur.
- Villes : Cotonou, Porto-Novo, Abomey-Calavi. Types de missions : voir `MISSION_TYPES` (valeurs en base, ne pas les renommer). Pour les afficher, toujours passer par `missionTypeLabel()` et `MISSION_TYPE_LABELS` de `src/lib/constants/missions.js` (Livraison s'affiche « Marché et achats ») ; jamais de `{mission.type}` brut (garde-fou `mission-type-display.guard.test.js`).
- Statuts mission : `open`, `in_progress`, `done`, `cancelled`. Candidature : `pending`, `accepted`, `rejected`. Transaction : `pending`, `paid`, `failed`, `refunded`.

## Sécurité
- Ne jamais lire, modifier ni commiter `.env*`.
- Jamais de `SERVICE_ROLE_KEY` côté client ni dans un composant.
- Montants, identité de l'appelant et rôle toujours vérifiés côté serveur.

## Conventions
- Commits Conventional Commits en anglais. Branches `feat/<TASK_ID>-<slug>`. Jamais de push sur `main`.
- Textes et commentaires en français, sans tiret cadratin : tiret simple "-".
- Nommage : composants en PascalCase, hooks `useXxx`, utils en camelCase.
