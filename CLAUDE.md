# EduCash Web PWA - Consignes pour les agents

Marketplace étudiants / clients au Bénin. Site en refonte "Direction A" : lire `REDESIGN.md` avant tout travail d'interface.

## Stack
- Next 16.2 (App Router, Turbopack), React 19, Tailwind 4 (`@tailwindcss/postcss`), JavaScript uniquement (pas de `.ts` ni `.tsx`).
- MUI 9 : gelé, en voie de retrait (vitrine historique). Ne pas l'étendre.
- Supabase (`@supabase/ssr`), FedaPay, Resend, next-pwa. Déploiement Vercel.
- Alias `@/` pour tous les imports. Server Components par défaut, `"use client"` seulement si nécessaire.
- Formulaires : react-hook-form + zod. Commandes : `npm run dev`, `npm run build`, `npx eslint <fichiers>`.
- Tests : Vitest, `npm test` (fichiers `src/**/*.test.{js,jsx}`, environnement node, config `vitest.config.mjs`).
- Ne jamais commiter `public/sw.js` ni `public/workbox-*.js` (générés par next-pwa au build).

## Design system (Direction A)
- Emplacement : `src/app/design/{tokens,components,layouts}.css`, importés par `src/app/globals.css`. Copie des maquettes `design-rebrand/maquettes/_system/` : ne pas le modifier hors d'une tâche dédiée.
- Couches : `tokens.css` dans `theme`, `components.css` et `layouts.css` dans `components` (reset dans la couche `base` imbriquée). 
- `.ds` ne porte que les styles de racine (police Figtree, couleur encre, fond givre). Le reset et les sélecteurs de composants sont globaux, dans la couche `components` : les utilitaires Tailwind gardent la priorité, mais un nom de classe du système utilisé hors `.ds` est stylé. Ne jamais réutiliser un nom de classe du système dans un écran Tailwind. Avant d'ajouter une classe au système, vérifier par grep qu'elle n'existe pas déjà dans le code ancien ; sinon la préfixer `ds-`.
- On consomme le système par ses classes (`.btn`, `.card`, `.badge`, `.field`, `.shell`...) et par `<Icon name="i-..." className="ic" />` (`src/components/design/icon.jsx`).
- Anti-collision avec Tailwind : les classes qui portent un nom d'utilitaire sont préfixées `ds-` : `ds-grid`, `ds-container`, `ds-grow`, `ds-table`, `ds-table-wrap`, `ds-h1` à `ds-h4`, `ds-pulse`. `sr-only` vient de Tailwind.
- Responsive : breakpoints 1024, 768 et 480 (media queries dans `tokens.css` et `layouts.css`). Classes `ds-desk-only` et `ds-mob-only` pour afficher selon la taille.
- Couleurs en dur interdites : uniquement `var(--c-*)`. Pas de `style={{}}`, pas de `<style>` local.
- Palette : bleu `#2F3BED`, citron `#C8F03C` (jamais en texte sur fond clair), encre `#0E0F1A`, givre `--c-givre`.
- Polices via `next/font` dans `layout.js` : variables `--font-anton`, `--font-figtree`, `--font-inter`, branchées sur `--f-display` (Anton) et `--f-text` (Figtree). Inter reste pour les espaces connectés pas encore refondus. Pas d'`@import` Google Fonts.
- Icônes : sprite externe `public/sprite.svg`, référencé avec `?v=` (`SPRITE_VERSION`). Incrémenter la version si le sprite change.
- Logo final et icônes PWA dans `public/`. Le `manifest.json` utilise `#2F3BED`.
- Ne JAMAIS utiliser une classe Tailwind dont le nom existe dans le système de design (exemple : `grow` au lieu de `ds-grow`, erreur déjà commise). Tailwind ne génère que les classes présentes dans le code : une classe absente du code n'existe pas au build.

## Cohabitation pendant la transition
- Les espaces connectés (`(student)`, `(client)`, `(admin)`, `legal/*`) restent en Tailwind avec parité stricte avec `main`. Ne pas les toucher sauf portage complet d'un écran.
- Les pages MUI sont à réécrire écran par écran, puis MUI sera retiré.
- Règle pour tout nouvel écran : uniquement les classes du système sous une racine `.ds`, en reprenant la maquette de `/Users/brandonmedehou/Desktop/EDUCASH/design-rebrand/maquettes/`. Pas de Tailwind ni de MUI dans un écran refondu.
- Exception tolérée : utilitaires Tailwind de dimension et de forme (w-*, h-*, max-w-*, rounded-full, object-cover) pour les squelettes de chargement et les images d'avatar, tant que le système ne fournit pas d'équivalent. Aucune couleur, aucun espacement de mise en page en Tailwind dans un écran refondu.
- UX : l'étudiant est tutoyé, le client vouvoyé, l'admin se tutoie entre collègues.

## Routes cibles (décision 14 de INVENTAIRE.md)
- Espace étudiant entièrement sous `/student/...` (`/dashboard`, `/applications`, `/messages`, `/wallet`, `/profile` y déménagent, avec redirections depuis les anciennes URL).
- Profil public étudiant : `/talents/[id]` (remplace `/students/[id]`).
- Nouvelles pages publiques en français : `/clients` et `/aide`.
- Espace client sous `/client/...`, espace admin sous `/admin/...`.

## Vitrine
- Éditeur légal : BRANDYBEN (entreprise individuelle), données dans `src/components/vitrine/legal/legal-entity.js`. Ne jamais écrire « EduCash SAS ».
- Pas de `loading.js` dans un segment qui appelle `notFound()`, sinon le statut devient 200 au lieu de 404.

## Variables d'environnement
- `CONTACT_INBOX_EMAIL` : destinataire du formulaire de contact (défaut `contact@educash.bj`). Les autres variables restent dans `.env.local`, jamais lu ni commité.

## Rôles
- `student`, `client` et `admin`. Le rôle est dans `user_metadata.role`, `middleware.js` redirige selon ce rôle.
- `user_metadata` est modifiable par l'utilisateur : ne s'en servir que pour l'affichage ou la navigation, jamais pour une autorisation. L'autorité se vérifie côté serveur sur `profiles.role`. Le `middleware.js` actuel s'appuie encore sur `user_metadata` : dette de sécurité connue, à traiter dans un lot dédié.
- L'admin ne peut jamais être auto-attribué (ni à l'inscription ni par mise à jour de profil). Un étudiant ne peut pas s'auto-vérifier.

## Données
- Accès aux données uniquement via `src/lib/actions` (server actions) et `src/lib/supabase/{client,server}.js`. Pas de couche `services` séparée.
- Une migration de Supabase vers **Neon** est prévue. Ne pas investir dans du nouveau SQL, des politiques RLS ou des Edge Functions spécifiques à Supabase, et garder l'accès aux données isolé dans `src/lib/actions` pour faciliter le changement.

## Métier
- Commission EduCash 12 % : `COMMISSION_RATE` et `netAmount()` dans `src/lib/constants/missions.js` (valeurs de `src/lib/supabase/database.constants.js`). Ne jamais écrire 0.12 en dur.
- Villes : Cotonou, Porto-Novo, Abomey-Calavi. Types de missions : voir `MISSION_TYPES`.
- Statuts mission : `open`, `in_progress`, `done`, `cancelled`. Candidature : `pending`, `accepted`, `rejected`. Transaction : `pending`, `paid`, `failed`, `refunded`.

## Sécurité
- Ne jamais lire, modifier ni commiter `.env*`.
- Jamais de `SERVICE_ROLE_KEY` côté client ni dans un composant.
- Montants, identité de l'appelant et rôle toujours vérifiés côté serveur.

## Conventions
- Commits Conventional Commits en anglais. Branches `feat/<TASK_ID>-<slug>`. Jamais de push sur `main`.
- Textes et commentaires en français, sans tiret cadratin : tiret simple "-".
- Nommage : composants en PascalCase, hooks `useXxx`, utils en camelCase.
