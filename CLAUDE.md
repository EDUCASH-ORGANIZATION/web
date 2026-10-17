# EduCash Web PWA - Consignes pour les agents

Marketplace étudiants / clients au Bénin. Site en refonte "Direction A" : lire `REDESIGN.md` avant tout travail d'interface.

## Stack
- Next 16.2 (App Router, Turbopack), React 19, Tailwind 4 (`@tailwindcss/postcss`), JavaScript uniquement (pas de `.ts` ni `.tsx`).
- MUI et Emotion : retirés du projet (RD-02). Ne pas les réintroduire.
- Supabase (`@supabase/ssr`), passerelle de paiement à définir (aucun prestataire nommé), Resend, next-pwa. Déploiement Vercel.
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
- Select : `<Select>` (`src/components/design/select.jsx`, logique pure dans `select-logic.js`) remplace le `<select>` natif dans la vitrine (variantes `chip`, `bare`, `field`). Classes `ds-select`, `ds-select--*`, `ds-select__bare`, `ds-select__menu`, liste = `.menu` du système. L'espace client porté l'utilise par `SelectField` (`src/components/app-ui/fields.jsx`) ; l'espace étudiant porté utilise le même composant ; l'espace admin porté l'utilise aussi (le motif de refus est une liste de choix `RadioGroupField`).
- Responsive : breakpoints 1024, 768 et 480 (media queries dans `tokens.css` et `layouts.css`). Classes `ds-desk-only` et `ds-mob-only` pour afficher selon la taille. Exception : l'en-tête vitrine a son propre seuil à 1360 px (navigation dans le burger entre 1024 et 1359 px, voir `layouts.css`).
- Titres Anton : interligne via `--lh-display` (1.14 minimum, accents des majuscules), sauf chiffres sans accents.
- Logos d'opérateurs dans `public/logos/operators/`, affichés via `OperatorLogo` (`src/components/vitrine/shared/`).
- Couleurs en dur interdites : uniquement `var(--c-*)`. Pas de `style={{}}`, pas de `<style>` local.
- Marque : charte graphique v1.0 (`/Users/brandonmedehou/Desktop/EDUCASH/Branding/EduCash_Charte_Graphique.pdf`) et kit logo `/Users/brandonmedehou/Desktop/EDUCASH/design-rebrand/logo-final` (logo en chemins, aucune police requise). DejaVu Sans est la police du logo uniquement : elle n'est ni chargée ni utilisée par le site.
- Palette (charte -> token) : Bleu `#1028F0` -> `--c-bleu` ; Vert `#C1EE3E` -> `--c-citron` (alias `--c-vert`) ; Encre `#17213A` -> `--c-encre` ; Brume `#F3F5FC` -> `--c-givre` ; Blanc `#FFFFFF` -> `--c-blanc`. Les noms de tokens sont conservés, seules les valeurs changent. `--c-brume` reste le gris secondaire sur encre (pas la Brume de la charte). Alias Tailwind `brand`, `brand-hover`, `brand-press`, `brand-soft`, `ink` dans `globals.css`.
- Règles de charte : le vert n'est jamais du texte sur fond clair (1,35:1 sur blanc) ni sous du texte blanc ; le bleu n'est jamais du texte sur encre (utiliser `--c-bleu-clair`) ; logo complet >= 150 px de large à l'écran, symbole >= 32 px ; le logo n'est jamais retapé en texte (emails compris) .
- Garde-fous : `brand-tokens.test.js` (contrastes calculés depuis `tokens.css`), `fonts-origin.guard.test.js` (polices du site inchangées), `email-brand.guard.test.js`.
- Polices via `next/font/google` dans `layout.js` : variables `--font-anton`, `--font-figtree`, `--font-inter`, branchées sur `--f-display` (Anton) et `--f-text` (Figtree). Inter reste pour les espaces connectés pas encore refondus. Pas d'`@import` Google Fonts. La charte ne change pas les polices du site.
- Icônes : sprite externe `public/sprite.svg`, référencé avec `?v=` (`SPRITE_VERSION`). Incrémenter la version si le sprite change.
- Logo final et icônes PWA dans `public/`, issus du kit `logo-final` (chemins publics inchangés). Le `manifest.json` utilise `theme_color` `#1028F0` et `background_color` `#F3F5FC`.
- Texte secondaire : `--c-ardoise` sur clair, `--c-brume` sur encre, blanc sur bleu ; taille `--t-para` (16 px, 15 px sous 768) ; jamais d'opacité sur du texte ; `--t-micro` (13 px) est le minimum absolu. Écart assumé avec maquettes/_system (RD-FIX-03).
- Ne JAMAIS utiliser une classe Tailwind dont le nom existe dans le système de design (exemple : oublier le préfixe de `ds-grow`, erreur déjà commise). Tailwind ne génère que les classes présentes dans le code : une classe absente du code n'existe pas au build.

## Cohabitation pendant la transition
- Les espaces client (`(client)`, racine `<div className="ds c2">`, RD-CLIENT-01) et étudiant (`(student)`, racine `<div className="ds e2">`, RD-STUDENT-01) sont portés sur le système de design. L'espace admin (`(admin)`, racine `<div className="ds a2">`, RD-ADMIN-01) est porté aussi : actions `src/lib/actions/admin-*.actions.js` (chaque fonction exportée appelle `requireAdminService()` avant tout accès), marqueur `@ds-screen RD-ADMIN-01` sur chaque fichier non test de `src/app/(admin)`, aucune exemption verte admin. La liste des motifs de refus de l'admin est `ADMIN_REJECTION_REASONS` (`src/lib/admin-space/decision-schemas.js`). Seul `legal/*` reste en Tailwind avec parité stricte avec `main` : ne pas le toucher sauf portage complet d'un écran.
- Espace client : `src/components/app-shell/` (coquille partagée, configurée par un `*-nav.js`), `src/components/app-ui/` (interface partagée), `src/components/client-space/<écran>/` (vues pures), `src/lib/app/` et `src/lib/client-space/` (logique pure), feuilles `src/app/design/{app-shell,client}.css`. Marqueur `// @ds-screen RD-CLIENT-01` en tête de chaque fichier de `src/app/(client)` (garde-fou `client-space.guard.test.js`).
- Espace étudiant : même coquille (`src/components/student-space/shell/student-nav.js`), vues pures dans `src/components/student-space/<écran>/`, logique pure dans `src/lib/student-space/`, actions dans `src/lib/actions/student-*.actions.js` et fonctions étudiant de `message.actions.js` et `review.actions.js` (`requireRole(["student"])` en première instruction), feuilles `src/app/design/student/*.css` sous `.e2`, fabriques d'URL `src/lib/app/student-routes.js`. Marqueur `// @ds-screen RD-STUDENT-01` en tête de chaque fichier non test de `src/app/(student)` (garde-fou `student-space.guard.test.js`) ; aucun fichier étudiant n'est exempté du vert (`src/lib/design/legacy-green/`).
- Règles des espaces client et étudiant : vouvoiement partout (messages d'erreur des actions compris) ; drapeaux d'URL (`?confirmer=1`, `?recharger=1`, `?candidat=`...) sans action, ils ouvrent seulement une modale, un tiroir ou une bannière ; jamais de `loading.js` sous un segment qui appelle `notFound()` ni sous ses parents (squelettes par `<Suspense>`) ; `requireRole` du rôle de l'espace en première instruction de chaque action de page ; vues pures sans accès aux données, page mince qui passe `paymentsEnabled={paymentsEnabled()}`.
- `src/components/admin` supprimé, l'admin vit dans `src/components/admin-space`.
- L'authentification (`/auth/*`) est refondue sur le design system (RD-02) ; plus aucune page MUI.
- Règle pour tout nouvel écran : uniquement les classes du système sous une racine `.ds`, en reprenant la maquette de `/Users/brandonmedehou/Desktop/EDUCASH/design-rebrand/maquettes/`. Pas de Tailwind dans un écran refondu.
- Exception tolérée : utilitaires Tailwind de dimension et de forme (w-*, h-*, max-w-*, rounded-full, object-cover) pour les squelettes de chargement et les images d'avatar, tant que le système ne fournit pas d'équivalent. Aucune couleur, aucun espacement de mise en page en Tailwind dans un écran refondu.
- Langue (UX) : tous les textes visibles (clients, étudiants, admin, emails, vitrine, messages d'erreur des actions serveur) sont au VOUVOIEMENT, jamais de tutoiement ; garde-fou global `src/lib/security/no-tutoiement.guard.test.js`. Deux publics seulement : les clients (familles, salariés, fonctionnaires, entreprises : même compte) sur `/`, les étudiants sur `/etudiants`. Pas de page ni de bloc « Entreprises ».

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
- `student`, `client` et `admin`.
- `user_metadata` est modifiable par l'utilisateur : ne s'en servir que pour l'affichage ou la navigation, jamais pour une autorisation. Toute autorisation lit `profiles.role` côté serveur via `getServerRole(supabase, user)` (`src/lib/auth/server-role.js`). La garde admin (layout et `assertAdmin`) exige `profiles.role = 'admin'`.
- Le rôle est lu uniquement depuis `profiles.role`, fail-closed (rôle introuvable ou compte suspendu : refus) : middleware, layouts et server actions passent par `getServerRole`, `requireRole(roles)` ou `requireUser()` (`src/lib/auth/require-role.js`). Plus aucune autorisation ne lit `user_metadata` (garde-fou `role-authority.guard.test.js`).
- Seul l'admin annule une mission `in_progress` (médiation). Un client n'annule qu'une mission `open`.
- L'admin ne peut jamais être auto-attribué (ni à l'inscription ni par mise à jour de profil). Un étudiant ne peut pas s'auto-vérifier. Les onboardings écrivent une liste blanche de colonnes (jamais `role`, `is_verified`, `is_suspended`, `verified_until`).

## Authentification
- Formulaires d'auth : action serveur (`useActionState`) ou `method="post"`, bouton `HydratedSubmit` inactif avant hydratation. Jamais de GET portant des identifiants.
- Cookies httpOnly `ec_pending_email` (adresse rappelée sur la page de vérification) et `ec_recovery` (autorise le nouveau mot de passe). Jamais d'email ni de mot de passe dans une URL.
- `next` toujours validé par `safeNextPath` et `isNextAllowedForRole`. Destinations dans `src/lib/auth/destinations.js`, schémas zod dans `src/lib/auth/schemas.js` (téléphone béninois 10 chiffres commençant par 01, stocké `+22901XXXXXXXX`).
- Aucune durée de validité de lien ni délai d'examen de carte affichés. Garde-fous : `vitrine-content.guard.test.js` (auth incluse) et `auth-emails.guard.test.js`.

## Données
- Accès aux données uniquement via `src/lib/actions` (server actions) et `src/lib/supabase/{client,server}.js`. Pas de couche `services` séparée.
- Une migration de Supabase vers **Neon** est prévue. Ne pas investir dans du nouveau SQL, des politiques RLS ou des Edge Functions spécifiques à Supabase, et garder l'accès aux données isolé dans `src/lib/actions` pour faciliter le changement.
- Purge : route `/api/cron/purge` (Cron Vercel, `CRON_SECRET`, simulation par défaut tant que `PURGE_ENABLED` n'est pas `true`), règles dans `src/lib/purge/purge-rules.js`, mode d'emploi dans `docs/LISEZMOI-purge.md` ; toute nouvelle donnée à durée limitée ou tout nouveau compartiment y est ajouté.
- Fermeture de compte : `closeAccount` / `reopenAccount` (admin) -> `account-closure-core.js`, pseudonymisation après `CLOSURE_GRACE_DAYS` par `/api/cron/purge` ; jamais `auth.admin.deleteUser` ni suppression de `profiles` (garde-fou `account-closure.guard.test.js`).

## Métier
- Commission EduCash 12 % : `COMMISSION_RATE` et `netAmount()` dans `src/lib/constants/missions.js` (valeurs de `src/lib/supabase/database.constants.js`). Ne jamais écrire 0.12 en dur.
- Villes : Cotonou, Porto-Novo, Abomey-Calavi. Types de missions : voir `MISSION_TYPES` (valeurs en base, ne pas les renommer). Pour les afficher, toujours passer par `missionTypeLabel()` et `MISSION_TYPE_LABELS` de `src/lib/constants/missions.js` (Livraison s'affiche « Marché et achats ») ; jamais de `{mission.type}` brut (garde-fou `mission-type-display.guard.test.js`).
- Statuts mission : `open`, `in_progress`, `done`, `cancelled`. Candidature : `pending`, `accepted`, `rejected`. Transaction : `pending`, `paid`, `failed`, `refunded`.

## Sécurité
- Ne jamais lire, modifier ni commiter `.env*`.
- Jamais de `SERVICE_ROLE_KEY` côté client ni dans un composant.
- Montants, identité de l'appelant et rôle toujours vérifiés côté serveur.
- `createServiceClient` (`src/lib/supabase/service.js`) est réservé au serveur, après contrôle d'identité, de rôle et de propriété. Jamais importé depuis un module `"use client"`, `src/components` ou `src/hooks` (garde-fou `service-client.guard.test.js`).
- Colonnes privées de profils (téléphone, jeton de notification, motif de refus, date de dépôt de la carte, `card_url`) : lues uniquement côté serveur via le service role, après contrôle de l'appelant (`profile.actions.js`, pages admin). Jamais de `select("*")` sur `profiles` ni `student_profiles`.
- Appels de portefeuille (réserver, libérer, rembourser) : client service role côté serveur, via `callWalletRpc` (`src/lib/wallet/wallet-rpc.js`). Succès seulement si `error == null` et `data.success === true`.
- Missions : `createMission` publie puis réserve les fonds, et supprime la mission si la réservation échoue. `discardMission` rembourse puis annule : la base refusera de supprimer une mission ayant des mouvements de portefeuille.
- Paiements en pause : tout est derrière `PAYMENTS_ENABLED` (faux par défaut). Lire le drapeau par `paymentsEnabled()` et afficher `PAYMENTS_PENDING_COPY` (`src/lib/constants/payments.js`). Les Edge Functions de paiement répondent 503 tant qu'il est désactivé, l'auto-release est inerte, aucun paiement automatique. Aucun prestataire de paiement nommé dans les textes visibles : la passerelle reste à définir.
- Garde-fous de sécurité : `vitrine-content`, `vocabulary.render`, `client-boundary`, `mission-type-display`, `role-authority`, `service-client`, `no-em-dash` (sans exception), `auth-emails`, `no-tutoiement` (vouvoiement partout : scanne les chaînes et le texte JSX visibles de tout `src/`, hors tests et hors le prompt LLM interne de `verify-card.actions.js` et la liste de mots du détecteur `space-guard-rules.js`), `payments-disabled`, et le test des colonnes privées dans `profile.actions.test.js`.

## Conventions
- Commits Conventional Commits en anglais. Branches `feat/<TASK_ID>-<slug>`. Jamais de push sur `main`.
- Textes et commentaires en français, sans tiret cadratin : tiret simple "-".
- Nommage : composants en PascalCase, hooks `useXxx`, utils en camelCase.
