# EduCash — Refonte web « Direction A »

Ce document décrit comment le site EduCash est reconstruit de zéro sur la
refonte validée. Les maquettes **écrasent** l'ancien code : rien n'est hérité
du thème vert/ambre ni des composants Tailwind de l'ancienne version.

- Branche : `feat/redesign-direction-a`
- Source de vérité du design : `~/Desktop/EDUCASH/design-rebrand/maquettes/`
  (`INVENTAIRE.md` définit les écrans cibles, `_system/` le système de design,
  un `STATUS.md` par espace détaille l'avancement des planches).
- Préfixe UX : étudiant tutoie, client vouvoie, admin se tutoie entre collègues.
- Décisions produit : voir `INVENTAIRE.md` section « Décisions produit prises ».

## Fondation technique

- Le système de design validé est fié tel quel dans l'app :
  `src/app/design/{tokens,components,layouts}.css`, importés par
  `src/app/globals.css`. `tokens.css` charge Anton + Figtree (Google Fonts)
  et définit `--c-bleu #2F3BED`, `--c-citron #C8F03C`, `--c-encre #0E0F1A`, etc.
- `layout.js` : thème `#2F3BED`, corps en `var(--f-text)` + fond `--c-givre`.
- Les composants du design system se consomment par les **classes** du système
  (`.btn`, `.card`, `.bento-card`, `.shell`, `.chat`, `.badge`, `.field`, …),
  comme dans les maquettes. Indexer l'usage dans `maquettes/_system/index.html`.
- `frames.css` (cadres 1440/390, états) sert uniquement aux planches, PAS à l'app.

## Mapping des routes (ouverts depuis `INVENTAIRE.md`)

### Vitrine (public)
| Route | Écran |
|---|---|
| `/` | V01 Accueil |
| `/missions` | V02 Missions publiques |
| `/missions/[id]` | V03 Détail de mission public |
| `/talents/[id]` | V04 Profil public étudiant |
| `/clients` | V05 Pour les clients |
| `/about` | V06 À propos |
| `/aide` | V07 Aide et FAQ |
| `/contact` | V08 Contact |
| `/legal/{mentions,privacy,terms}` | V09 Pages légales |

### Authentification
| Route | Écran |
|---|---|
| `/auth/login` | A01 Connexion |
| `/auth/register` | A02 Inscription |
| `/auth/verify-email` | A03 Vérification email |
| `/auth/link-expired` | A04 Lien invalide/expiré |
| `/auth/forgot-password` | A05 Mot de passe oublié |
| `/auth/reset-password` | A06 Nouveau mot de passe |
| `/auth/register/student` | A07 Onboarding étudiant |
| `/auth/register/client` | A08 Onboarding client |

### Étudiant (tous sous `/student/`)
Cache, candidates, messages, portefeuille, profil : E01-E13 (voir inventaire).

### Client (tous sous `/client/`)
Missions, publication, candidatures, portefeuille (séquestre, recharge,
retrait), profil : C01-C17.

### Admin (tous sous `/admin/`)
Tableau de bord, vérifications, utilisateurs, missions, finances, signalements,
statistiques, paramètres, journal d'audit : AD01-AD16.

### Transverses
`/notifications` T01, `/settings` T02, Signaler T03, 404 T04, erreur/
maintenance T05, `/offline` T06, PWA T07.

## Contrat de construction d'un espace (utiliser pour déléguer aux agents)

1. Copier la structure de l'espace depuis `maquettes/<espace>/` (planches HTML).
2. Produire les composants React (Server Components par défaut) qui utilisent
   les **classes du design system** uniquement ; pas de `<style>` local, pas de
   couleur en dur (`var(--...)`).
3. Reproduire chaque **état** listé dans `INVENTAIRE.md` (chargement, erreur,
   vide, hors ligne, etc.).
4. Câbler les données depuis `@/services`/Supabase (les règles métier de
   `INVENTAIRE.md` : séquestre, commission 12 %, minimums, décision 24…).
5. Vérification : capture Chromium headless + contrôle visuel (voir skill
   `educash-maquettes`).

## Backend & sécurité (à part, après la coquille)

- Adapter les rôles/RLS Supabase (aucun utilisateur ne peut devenir admin, un
  étudiant ne peut pas s'auto-vérifier, identité de l'appelant dans les
  retraits/dépôts, solde atomique sans double exécution) — faille critiques
  relevées à l'exploration initiale.
- Séquestre / FedaPay conformes aux décisions produit (recharger/retirer via
  FedaPay ; fin de mission en deux temps ; achats hors plateforme).