# EduCash - Refonte web « Direction A »

Ce document décrit comment le site EduCash est reconstruit de zéro sur la
refonte validée. Les maquettes **écrasent** l'ancien code : rien n'est hérité
du thème vert/ambre ni des composants Tailwind de l'ancienne version.

- Branche : une branche `feat/<TASK_ID>-<slug>` par lot.
- Source de vérité du design : `~/Desktop/EDUCASH/design-rebrand/maquettes/`
  (`INVENTAIRE.md` définit les écrans cibles, `_system/` le système de design,
  un `STATUS.md` par espace détaille l'avancement des planches).
- Préfixe UX : étudiant tutoie, client vouvoie, admin se tutoie entre collègues.
- Décisions produit : voir `INVENTAIRE.md` section « Décisions produit prises ».

## Fondation technique (faite)

- Le système de design validé est copié tel quel dans l'app :
  `src/app/design/{tokens,components,layouts}.css`, importés par
  `src/app/globals.css`. `tokens.css` définit `--c-bleu #2F3BED`,
  `--c-citron #C8F03C`, `--c-encre #0E0F1A`, `--c-givre`, etc.
- **Couches CSS** : `tokens.css` dans la couche `theme`, `components.css` et
  `layouts.css` dans la couche `components` (reset dans la couche `base`
  imbriquée). `.ds` ne porte que les styles de racine (police Figtree, couleur
  encre, fond givre). Le reset et les sélecteurs de composants sont globaux,
  dans la couche `components` : les utilitaires Tailwind gardent la priorité,
  mais un nom de classe du système utilisé hors `.ds` est stylé. Ne jamais
  réutiliser un nom de classe du système dans un écran Tailwind. Avant d'ajouter
  une classe au système, vérifier par grep qu'elle n'existe pas déjà dans le
  code ancien ; sinon la préfixer `ds-`.
- **Anti-collision Tailwind** : préfixe `ds-` pour les classes qui portent un
  nom d'utilitaire : `ds-grid`, `ds-container`, `ds-grow`, `ds-table`, `ds-table-wrap`,
  `ds-h1` à `ds-h4`, `ds-pulse`. `sr-only` est fourni par Tailwind.
- **Polices** : chargées par `next/font/google` dans `layout.js` (plus aucun
  `@import` Google Fonts). Variables `--font-anton`, `--font-figtree` et
  `--font-inter`, branchées sur `--f-display` (Anton) et `--f-text` (Figtree).
  Inter est conservée pour les espaces connectés pas encore refondus.
- **Sprite d'icônes** : externe, `public/sprite.svg`, appelé avec `?v=`
  (cache-busting) via `<Icon name="i-..." className="ic" />`
  (`src/components/design/icon.jsx`).
- **Logo et PWA** : logo final et icônes dans `public/`, `manifest.json` en `#2F3BED`.
- **Pas de couleur en dur** : seulement `var(--c-*)`. Le citron n'est jamais
  utilisé en texte sur fond clair.
- **Texte secondaire** : `--c-ardoise` sur clair, `--c-brume` sur encre, blanc sur bleu ; taille `--t-para` (16 px, 15 px sous 768) ; jamais d'opacité sur du texte ; `--t-micro` (13 px) est le minimum absolu. Écart assumé avec maquettes/_system (RD-FIX-03).
- **Titres Anton** : interligne via `--lh-display` (1.14 minimum, 1.16 en xxl), sauf chiffres sans accents. Écart assumé avec maquettes/_system (RD-FIX-05).
- **Logos d'opérateurs** : vrais logos MTN et Moov dans `public/logos/operators/`, affichés via `OperatorLogo`, à la place des pastilles typographiques des maquettes (RD-FIX-05).
- Les composants se consomment par les **classes** du système (`.btn`, `.card`,
  `.bento-card`, `.shell`, `.chat`, `.badge`, `.field`...), comme dans les
  maquettes. Index : `maquettes/_system/index.html`.
- `frames.css` (cadres 1440/390, états) sert uniquement aux planches, PAS à l'app.

## Stratégie responsive

- Breakpoints : 1024 (bureau / tablette), 768 et 480 (mobile), en media queries
  dans `tokens.css` et `layouts.css`. Les `var()` étant interdites dans une
  condition `@media`, les seuils sont écrits en dur.
- Les variantes mobiles `--m` des maquettes sont appliquées par media query.
- Classes utilitaires du système : `ds-desk-only` (visible au-dessus de 1024) et
  `ds-mob-only` (visible en dessous).
- Pas de `style={{}}` pour adapter une mise en page.

## Cohabitation pendant la transition

- Les espaces connectés restent en Tailwind avec parité stricte avec `main`
  (Inter, fond blanc, mode sombre) tant qu'un écran n'est pas porté.
- Les pages MUI sont à réécrire, puis MUI sera retiré.
- Nouvel écran : uniquement les classes du système sous `.ds`, d'après la
  maquette de `design-rebrand/maquettes/`.

## Mapping des routes (ouverts depuis `INVENTAIRE.md`)

### Vitrine (public)
| Route | Écran |
|---|---|
| `/` | V01 Accueil |
| `/missions` | V02 Missions publiques |
| `/missions/[id]` | V03 Détail de mission public |
| `/talents/[id]` | V04 Profil public étudiant (remplace `/students/[id]`) |
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

### Étudiant (tous sous `/student/`, décision 14)
Tableau de bord, missions, candidatures, messages, portefeuille, profil : E01-E13 (voir inventaire). Les anciennes URL (`/dashboard`, `/applications`, `/messages`, `/wallet`, `/profile`) redirigent vers `/student/...`.

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
4. Câbler les données depuis `src/lib/actions` et `src/lib/supabase` (les règles métier de
   `INVENTAIRE.md` : séquestre, commission 12 %, minimums, décision 24…).
5. Vérification : capture Chromium headless + contrôle visuel (voir skill
   `educash-maquettes`).

## Vitrine publique (RD-01)

- **Composants partagés** : `src/components/vitrine/shared/` (fil d'Ariane, en-tête
  de page, FAQ, CTA double, note de séquestre, blocs d'état, page introuvable
  de la vitrine). Les blocs propres à un écran sont dans
  `src/components/vitrine/{home,clients,aide,contact,legal,talent,mission-detail}/`.
- **Logique** : `src/lib/vitrine/` (formats, dates, chiffres, noms publics,
  disponibilité d'une mission, CTA de candidature, redirections héritées), avec
  tests Vitest à côté.
- **Routes** : `/clients` (V05), `/aide` (V07), `/talents/[id]` (V04).
  `/students/[id]` redirige en 308 vers `/talents/[id]`.
- **Groupes de routes** : `(home)` porte `/` et son `loading.js`;
  `(mission-detail)` porte `/missions/[id]` sans `loading.js` (voir la règle
  ci-dessous). Ils isolent les squelettes de chargement des autres pages.
- **Règle `loading.js`** : pas de `loading.js` dans un segment qui appelle
  `notFound()`, sinon le statut HTTP devient 200 au lieu de 404.
- **Éditeur légal** : BRANDYBEN (entreprise individuelle). Les informations
  sont regroupées dans `src/components/vitrine/legal/legal-entity.js` et
  partagées par les trois pages légales. Ne jamais écrire « EduCash SAS ».
- **Formulaire de contact** : `/contact` envoie le message par e-mail (Resend)
  via la server action `src/lib/actions/contact.actions.js`. Le destinataire
  vient de la variable d'environnement `CONTACT_INBOX_EMAIL` (défaut
  `contact@educash.bj`), jamais du formulaire.
- **Dépendances 3D retirées** : `three`, `@react-three/fiber` et
  `@react-three/drei` ne sont plus utilisées par la vitrine. MUI reste pour
  l'authentification (`auth-shell`, `stack`, `theme`, `vitrine-provider`).

## Suivi des écrans

États : porté, partiel, à faire. Fondation faite ; vitrine V01 à V09 faite (V02 en RD-00, le reste en RD-01) ;
tout le reste à faire.

### Vitrine (V01 à V09)
| Écran | Titre | État |
|---|---|---|
| V01 | Accueil | fait (RD-01) |
| V02 | Missions publiques | fait (RD-00) |
| V03 | Détail de mission public | fait (RD-01) |
| V04 | Profil public d'un étudiant | fait (RD-01) |
| V05 | Pour les clients | fait (RD-01) |
| V06 | À propos | fait (RD-01) |
| V07 | Aide et FAQ | fait (RD-01) |
| V08 | Contact | fait (RD-01) |
| V09 | Pages légales | fait (RD-01) |

### Authentification (A01 à A08)
| Écran | Titre | État |
|---|---|---|
| A01 | Connexion | à faire |
| A02 | Inscription | à faire |
| A03 | Vérification de l'email | à faire |
| A04 | Lien de confirmation invalide ou expiré | à faire |
| A05 | Mot de passe oublié | à faire |
| A06 | Nouveau mot de passe | à faire |
| A07 | Onboarding étudiant | à faire |
| A08 | Onboarding client | à faire |

### Étudiant (E01 à E13)
| Écran | Titre | État |
|---|---|---|
| E01 | Tableau de bord étudiant | à faire |
| E02 | Explorer les missions | à faire |
| E03 | Détail de mission et candidature | à faire |
| E04 | Mes candidatures | à faire |
| E05 | Mission retenue (suivi) | à faire |
| E06 | Messages | à faire |
| E07 | Conversation | à faire |
| E08 | Portefeuille | à faire |
| E09 | Retrait | à faire |
| E10 | Mon profil | à faire |
| E11 | Modifier le profil | à faire |
| E12 | Vérification | à faire |
| E13 | Noter le client | à faire |

### Client (C01 à C17)
| Écran | Titre | État |
|---|---|---|
| C01 | Tableau de bord client | à faire |
| C02 | Mes missions | à faire |
| C03 | Publier une mission | à faire |
| C04 | Mission ouverte et candidatures | à faire |
| C05 | Profil du candidat | à faire |
| C06 | Modifier une mission | à faire |
| C07 | Annuler une mission | à faire |
| C08 | Mission en cours | à faire |
| C09 | Confirmer la fin de mission | à faire |
| C10 | Noter l'étudiant | à faire |
| C11 | Mission terminée ou annulée | à faire |
| C12 | Messages | à faire |
| C13 | Conversation | à faire |
| C14 | Portefeuille client | à faire |
| C15 | Recharge et retour FedaPay | à faire |
| C16 | Retrait client | à faire |
| C17 | Profil client | à faire |

### Admin (AD01 à AD16)
| Écran | Titre | État |
|---|---|---|
| AD01 | Tableau de bord admin | à faire |
| AD02 | File de vérification | à faire |
| AD03 | Utilisateurs | à faire |
| AD04 | Fiche utilisateur | à faire |
| AD05 | Suspendre, réactiver, réinitialiser | à faire |
| AD06 | Missions | à faire |
| AD07 | Détail mission (admin) | à faire |
| AD08 | Remboursement forcé et clôture | à faire |
| AD09 | Signalements | à faire |
| AD10 | Détail d'un signalement ou litige | à faire |
| AD11 | Journal des transactions | à faire |
| AD12 | Portefeuilles | à faire |
| AD13 | Retraits | à faire |
| AD14 | Statistiques | à faire |
| AD15 | Paramètres | à faire |
| AD16 | Journal d'audit | à faire |

### Transverses (T01 à T07)
| Écran | Titre | État |
|---|---|---|
| T01 | Centre de notifications | à faire |
| T02 | Paramètres du compte | à faire |
| T03 | Signaler | à faire |
| T04 | Page introuvable (404) | à faire |
| T05 | Erreur et maintenance | à faire |
| T06 | Hors ligne | à faire |
| T07 | Installation de l'application et démarrage | à faire |

## Backend & sécurité (à part, après la coquille)

- Une migration de Supabase vers Neon est prévue : pas de nouveau SQL, RLS ou
  Edge Functions spécifiques à Supabase, accès aux données isolé dans
  `src/lib/actions`.
- Adapter les rôles (student, client, admin) et la sécurité des données (aucun utilisateur ne peut devenir admin, un
  étudiant ne peut pas s'auto-vérifier, identité de l'appelant dans les
  retraits/dépôts, solde atomique sans double exécution) - failles critiques
  relevées à l'exploration initiale.
- Séquestre / FedaPay conformes aux décisions produit (recharger/retirer via
  FedaPay ; fin de mission en deux temps ; achats hors plateforme).
