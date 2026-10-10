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
- Plus aucune page MUI : MUI et Emotion sont retirés du projet (RD-02).
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
  `@react-three/drei` ne sont plus utilisées par la vitrine. MUI a été retiré
  avec la refonte de l'authentification (RD-02).

## Suivi des écrans

États : porté, partiel, à faire. Fondation faite ; vitrine V01 à V09 faite (V02 en RD-00, le reste en RD-01) ;
authentification A01 à A08 faite (RD-02) ; tout le reste à faire.

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
| A01 | Connexion | fait (RD-02) |
| A02 | Inscription | fait (RD-02) |
| A03 | Vérification de l'email | fait (RD-02) |
| A04 | Lien de confirmation invalide ou expiré | fait (RD-02) |
| A05 | Mot de passe oublié | fait (RD-02) |
| A06 | Nouveau mot de passe | fait (RD-02) |
| A07 | Onboarding étudiant | fait (RD-02) |
| A08 | Onboarding client | fait (RD-02) |

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

## Select maison (RD-FIX-07)

- `<Select>` (`src/components/design/select.jsx`) remplace le `<select>` natif sur la vitrine : accueil (ville du hero), `/missions` (ville, Ville, Budget, Urgence, Tri) et `/contact` (Sujet). Motif APG select-only combobox, liste `.menu` / `.menu__item` du système.
- La maquette V02 montre les listes ouvertes (titre `.menu__title`, option cochée) et V08 la liste du sujet ; la liste du hero (sans maquette dédiée) reprend les mêmes styles.
- Hors périmètre : les selects des espaces connectés (`(student)`, `(client)`, `(admin)`, `components/client|student|admin|profile|auth`) restent natifs, en parité Tailwind avec `main`. Ils adopteront `<Select>` à leur refonte.

## En-tête fixe et photo du hero (RD-FIX-07)

- En-tête fixe (`position: fixed`) sur toute la vitrine, avec un emplacement `.site-header-slot` qui réserve la hauteur (aucun décalage). Au-delà de 16 px de défilement (`useSyncExternalStore` sur le scroll) il passe en compact : hauteur `--h-header-compact`, fond blanc translucide avec `backdrop-filter` (repli blanc plein), bordure encre 2 px. Sur l'accueil (`tone="bleu"`) il reste transparent sur le hero puis devient l'en-tête blanc compact.
- Échelle `z-index` (tokens) : sticky 10, nav (en-tête) 20, menu (listes du Select) 30, drawer (menu mobile plein écran) 40, modal (feuille Filtres) 50, toast 60. `scroll-padding-top` sur `html` pour les ancres.
- Photo du hero : `public/images/hero/portrait-hero.webp` (733 x 1240, 57 Ko, transparence conservée). Crédit : Abraham Ocholi, Pexels (licence Pexels, attribution non requise). Chargée en `loading="lazy"` et préchargée uniquement à partir de 1024 px (`media`) : elle n'est jamais téléchargée quand le visuel est masqué.
- Select : la liste s'ouvre vers le bas dès que la place suffit (168 px) et défile avec un plafond de hauteur ; elle ne remonte que si la place en bas est vraiment insuffisante.

## Hero sur aplat citron et ancres (RD-FIX-08)

- Hero de l'accueil : l'aplat citron arrondi bordé encre derrière le visuel est restauré à l'identique d'avant RD-FIX-07 (balisage `photo-ph` dans `home-hero.jsx`, règle de surimpression dans `components.css`, retraits 0 0 56px 56px, rayon `--r-xl`). La photo est centrée dessus, pied de l'image posé en bas de l'aplat.
- Photo : `public/images/hero/portrait-hero.webp`, portrait libre de droits d'Abraham Ocholi (Pexels), détouré de nouveau depuis le JPEG d'origine. WebP transparent de 644 x 1100, 58 Ko. Le chargement conditionnel est inchangé (rien n'est téléchargé sous 1024 px).
- Notification `.v-hero__push` descendue à `top: 225px` pour passer sous le menton sans masquer le visage ; carte, pastille tournante et étincelle restent au-dessus de la photo.
- Procédure de détourage (macOS, sans service externe) : réduction du JPEG, masque de premier plan par le framework Vision (script Swift `VNGenerateForegroundInstanceMaskRequest`), affinage du bord et décontamination de la couleur du fond gris beige en Python (Pillow), contrôle visuel sur fonds citron et bleu agrandis (tresses, épaule, espace bras / buste), export `cwebp` avec canal alpha. Les scripts de travail ne sont pas versionnés.
- Ancres : `/#etapes` (en-tête, menu burger, pied de page, aperçu des missions) renvoyait en haut de page. Deux causes racines. 1) Le squelette `loading.js` de l'accueil s'affiche d'abord : Next cherche l'ancre dans ce squelette, où la section n'existe pas encore, puis oublie l'ancre quand le vrai contenu arrive. 2) Cliquer un lien dont le fragment est déjà dans l'URL est traité comme une navigation complète vers la même adresse et ne défile pas.
- Correctif : `src/components/vitrine/shared/hash-scroll.jsx`. `HashScroll`, monté dans le contenu de la page (accueil, FAQ de l'aide via `FaqHash`), défile vers la cible une fois présente et à chaque `hashchange`. `AnchorLink` remplace `next/link` pour tout lien d'ancre de la vitrine : sur la page affichée il défile lui-même (en respectant `scroll-padding-top` de l'en-tête fixe) et met l'URL à jour par `history.pushState` ; vers une autre page il laisse Next naviguer. Les liens `<a href="#id">` natifs (sommaires, lien d'évitement) n'ont pas besoin du composant.
- Garde-fous : `anchors.test.js` vérifie que chaque ancre écrite en dur vise un id existant et qu'aucun lien `next/link` ne porte d'ancre ; `hash-scroll.test.js` couvre la logique de défilement. Le composant mort `components/shared/navbar.jsx` (lien `/#how-it-works` sans cible) est une exception documentée.

## Photo détourée dans le hero de /clients (RD-FIX-09)

- Hero de `/clients` : l'aplat citron arrondi `photo-ph` et la photo détourée sont posés dans `.v05-visual`, comme sur l'accueil (même `.v-hero__picture` et `.v-hero__photo`, retraits 0 0 56px 56px, rayon `--r-xl`). La carte « Exemple de mission » et la pastille tournante restent au-dessus de la photo, à plus de 20 px sous le menton. Le gribouillis d'étincelle est retiré (principe : calme).
- Photo : `public/images/clients/portrait-client.webp`, portrait libre de droits de Daniel Sunga (Pexels, licence Pexels, attribution non requise), détouré depuis le JPEG d'origine. Cadrage en buste (tête à la taille), WebP transparent de 562 x 920, 58 Ko. Chargement seulement à partir de 1024 px (`<picture>` avec `media`, repli en pixel data URI) : rien n'est téléchargé en dessous, où la mise en page d'avant reste.
- Méthode : même procédure que RD-FIX-08 (réduction du JPEG, masque de premier plan Vision en Swift, export `cwebp` avec alpha). Différences liées au fond vert foncé : la couleur du fond est estimée sur les quatre coins, retirée des pixels à alpha partiel, puis le vert est plafonné à `max(rouge, bleu)` dans une bande de 4 px au bord du sujet (costume bleu marine et peau sans vert), ce qui supprime le liseré sur les cheveux, les épaules et entre les bras. Contrôle visuel sur fonds citron et bleu agrandis. Les scripts de travail ne sont pas versionnés.
- Garde-fou : `clients-hero.test.jsx` (ordre aplat, picture, carte ; media 1024 ; pas d'étincelle).

## Repositionnement de la vitrine (RD-POS-01)

- Deux publics seulement, comme le produit : les clients (familles, salariés, fonctionnaires, entreprises : même compte, même parcours) et les étudiants. Les décisions de `.agents/tasks/RD-POS-01/decisions.md` priment sur les maquettes v3 (`vitrine/positionnement-v3.html`, `V01-accueil.v3.html`, `V05-etudiants.v3.html`).
- `/` (maquette V01 v3) parle aux clients, en vouvoiement partout. Hero « Votre temps est précieux. Déléguez. » avec un champ « De quoi avez-vous besoin ? », la ville (Select maison) et « Publier » : formulaire GET vers `/client/missions/new?besoin=...&ville=...`. Sections : preuves, Services (`id="services"`, 8 cartes), « Le marché à votre place » (`id="achats"`), Comment ça marche (`id="etapes"`), confiance, FAQ clients, CTA final avec le bloc vouvoyé « Vous êtes étudiant ? » vers `/etudiants`. Aucun bloc « Entreprises », aucun compteur ni témoignage.
- `/etudiants` (maquette V05 v3) reprend le discours étudiant tutoyé (« Bosse entre deux cours. Encaisse. ») : recherche vers `/missions`, missions ouvertes, gains calculés depuis `COMMISSION_RATE`, étapes, retrait et vérification, services vers `/missions?type=<valeur>`, FAQ, CTA « Créer mon compte » et carte vouvoyée vers `/`. Composants dans `src/components/vitrine/etudiants/`, copiés (jamais importés) de ceux de l'accueil.
- `/clients` : redirection 308 vers `/` dans `middleware.js` (requête conservée), absent du sitemap ; `/etudiants` y figure. Aucun lien interne vers `/clients`.
- En-tête et pied de page selon le public (prop `audience`, `"clients"` par défaut ou `"etudiants"`) : liens Services et Aide, « Vous êtes étudiant ? », Se connecter et « Publier une mission » côté clients ; Missions et Aide, Se connecter et « Créer mon compte » sur `/etudiants` (retour vers les clients dans le menu burger). « Comment ça marche » a quitté l'en-tête et le menu burger : il reste dans le pied de page (`/#etapes` ou `/etudiants#etapes` selon le public). Jamais de lien « Pour les clients » ni « Entreprises » ; « Missions » n'est dans l'en-tête que pour les étudiants. `/missions`, son squelette et le détail `/missions/[id]` et son 404 s'adressent aux étudiants (`audience="etudiants"`), si bien que le lien « Missions » reste dans le même public et y est actif (actif aussi sur `/missions/<id>`, préfixe réservé à ce lien).
- Dictionnaire d'affichage unique dans `src/lib/constants/missions.js` : `MISSION_TYPE_LABELS`, `MISSION_TYPE_TAGLINES`, `MISSION_TYPE_PHRASES`, `MISSION_TYPE_OPTIONS`, `missionTypeLabel(valeur)`. Les valeurs en base de `MISSION_TYPES` ne changent pas (Livraison s'affiche « Marché et achats »), seule `Démarches` est ajoutée (colonne `missions.type` en texte libre : aucune migration, script de diagnostic fourni hors dépôt). Les filtres `?type=` gardent la valeur en base. Garde-fou : `src/lib/vitrine/mission-type-display.guard.test.js` refuse tout affichage brut de `.type`.
- `HeroPhoto` (`src/components/vitrine/shared/hero-photo.jsx`) mutualise le balisage de la photo de hero : `HERO_PHOTOS.client` (`portrait-client.webp`, 562 x 920) pour `/`, `HERO_PHOTOS.student` (`portrait-hero.webp`, 644 x 1100) pour `/etudiants`. Chargement seulement à partir de 1024 px, comme avant.
- Opérateurs : MTN MoMo, Moov Money et Celtiis Cash sont affichés ensemble partout où la vitrine les liste (décision de l'utilisateur). Les fenêtres de recharge et de retrait des espaces connectés ne proposent pas Celtiis (non supporté fonctionnellement) : à traiter dans un lot dédié.
- Le prestataire de paiement n'est jamais nommé dans les textes visibles de la vitrine, des pages légales et des emails (« notre prestataire de paiement agréé »). À faire relire par un juriste.
- Vocabulaire : plus de « livraison », « course(s) », « coursier(s) », « saisie » ni « Bientôt » dans les textes vitrine et les emails ; « commission » est réservé aux 12 %. Garde-fous : `vitrine-content.guard.test.js` (mots bannis, lien `/clients`) et `vocabulary.render.test.jsx` (texte rendu des sections de `/` et `/etudiants`).
- Pré-remplissage de la publication : `parsePublishPrefill` et `publishHref` (`src/lib/utils/publish-prefill.js`) ; `/client/missions/new` lit `besoin`, `ville` et `type` (valeurs hors liste ignorées). Le middleware conserve la requête dans `next` pour un visiteur non connecté. Le pré-remplissage traverse l'inscription et l'écran « portefeuille insuffisant » depuis RD-02.
- Styles du lot repliés en fin de `components.css` (règles) et de `layouts.css` (media queries, après le dernier bloc 1023.98 : voir `layouts-order.test.js`).

## Authentification (RD-02)

- Écrans A01 à A08 sous une racine `.ds` avec le gabarit `.auth` (une seule colonne sous 1024 px, un seul DOM). Panneau bleu pour l'étudiant (tutoiement), panneau encre `auth__brand--client` pour le client (vouvoiement). Les pages neutres (`/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/link-expired`) vouvoient tant que le public est inconnu. `AuthShell` (`src/components/vitrine/auth-shell.jsx`) prend `audience`, `brand`, `backHref`, `backLabel` et `signOutAction` (lien « Se déconnecter » en haut des onboardings). Composants partagés dans `src/components/auth/ui/`.
- Routes : `/auth/login`, `/auth/register` (`?role=student|client`, `next`), `/auth/verify-email`, `/auth/link-expired?cause=expire|utilise|autre-appareil|invalide`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/confirm` (code PKCE ou `token_hash`), `/auth/callback` (liens déjà envoyés, délègue au même gestionnaire), `/auth/register/student` et `/auth/register/client` (onboardings, session requise).
- Formulaires à action serveur (`useActionState`, POST) avec `HydratedSubmit` : bouton inactif tant que la page n'est pas hydratée, jamais d'identifiants dans l'URL. Validation zod côté client et côté serveur (`src/lib/auth/schemas.js`). Téléphone béninois : 10 chiffres commençant par 01, stocké en `+22901XXXXXXXX`.
- Cookies httpOnly : `ec_pending_email` (adresse rappelée sur A03, jamais dans l'URL) et `ec_recovery` (autorise A06, 15 min).
- Rôle : seuls `student` et `client` à l'inscription ; l'autorité se lit sur `profiles.role` par `getServerRole` (`src/lib/auth/server-role.js`). Garde admin (layout et `assertAdmin`) sur `profiles.role = 'admin'`. Les onboardings écrivent une liste blanche de colonnes, jamais `role`, `is_verified`, `is_suspended` ni `verified_until`. Reste au lot RD-SEC-01 : autorité serveur dans le middleware, les layouts étudiant et client et toutes les server actions.
- `next` : `safeNextPath` et `isNextAllowedForRole` à chaque étape ; le pré-remplissage de publication (`besoin`, `ville`, `type`) survit à la connexion, l'inscription, la confirmation, l'onboarding client et l'écran « portefeuille insuffisant » (`ResumePublishLink`).
- Emails : gabarits Supabase de confirmation et de réinitialisation dans `supabase/templates/` (à coller dans le tableau de bord, Redirect URLs `https://www.educash.bj/auth/**` et `https://educash.bj/auth/**`), gabarits Resend sans tiret cadratin. Aucune durée de validité affichée.
- Garde-fous : `vitrine-content.guard.test.js` scanne `src/app/auth` et `src/components/auth` (formulaires, délais, couleurs, accès aux tables), `auth-emails.guard.test.js` scanne tous les gabarits Resend.
- Reporté : second champ « Votre nom » (contact PME ou association) de l'onboarding client.
