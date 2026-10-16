# Banc de fidélité aux planches v2.1

Compare, sélecteur par sélecteur, une planche de `design-rebrand/maquettes/` et le rendu statique de la
vue correspondante (données des planches, vouvoiement). Les mesures sont : position et taille (x, y, w, h),
typographie, couleurs, rayons, marges, gouttières. Tolérance : 1 px.

Le banc est hors `src/` (les garde-fous de textes ne le scannent pas) et `npm test` ne l'exécute pas.

## Prérequis

- `npm ci` (`playwright-core` est une devDependency : aucun navigateur n'est téléchargé).
- `FIDELITY_CHROMIUM` : chemin d'un Chromium headless déjà installé, par exemple
  `~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
  Sans cette variable, le chemin par défaut de Playwright est essayé, sans téléchargement.
- Réseau : la planche charge ses polices depuis Google Fonts. Hors réseau, la police de repli change les
  largeurs de texte ; le banc compare alors la largeur (`w`, `tw`) et un écart dû à la police se déclare
  `POLICE:n` (statut `ASSUMÉ-POLICE`, distinct de `OK` ; `POLICE` n'est admis que sur `w` et `tw`, avec limite). Les mesures de référence de ce dépôt sont prises
  avec les polices disponibles ; relancer en ligne avant de conclure sur une largeur de texte.
- Compatibilité : `playwright-core` 1.56.1 pilote le Chromium de révision 1243
  (`chromium_headless_shell-1243`, ou `chromium-1243`) : vérifié, le banc s'y connecte et mesure.
- Optionnel : `FIDELITY_OUT` (dossier de sortie ; défaut `/tmp/educash-fidelity/<hash>`, où `<hash>` est dérivé du chemin du dépôt : un dossier par worktree, deux bancs lancés en parallèle depuis deux worktrees ne s'écrasent plus `app.css` ; la variable garde la priorité ; deux bancs dans le même worktree restent à ne pas lancer en même temps), `FIDELITY_MAQUETTES` (dossier des planches ; défaut : `design-rebrand/maquettes`, frère de `organization/`, résolu depuis la racine du dépôt, donc valable depuis `web/` et depuis `organization/web-*`).

## Utilisation

```
npm run fidelity -- E06              # un écran
npm run fidelity -- E06,E07,C12,C13  # plusieurs écrans
npm run fidelity -- E07 --report-only  # ne pas échouer sur les écarts
```

Sortie dans `$FIDELITY_OUT/<ID>/` (ou `/tmp/educash-fidelity/<hash>/<ID>/` par défaut ; le dossier utilisé est rappelé en fin de sortie) : `planche-bureau.png`, `code-bureau.png`, `planche-mobile.png`,
`code-mobile.png`, `rapport.md`, `rapport.json`. Le rapport est aussi écrit sur la sortie standard :
tableau Élément / Planche / Code / Écart / Statut, avec le statut `OK`, `ASSUMÉ Ax` (tous les codes appliqués,
par exemple `ASSUMÉ A2, A3`), `ASSUMÉ-POLICE` (police seule), `NON EXPLIQUÉ ... X1` ou `ÉCHEC`. Le récapitulatif compte
à part chaque statut ; un statut mixte `ASSUMÉ A3, POLICE` est compté dans ASSUMÉ (rappelé par « dont avec POLICE »).
Code de sortie 1 s'il reste un `ÉCHEC` (sauf `--report-only`), 2 en cas d'erreur du banc.

Rognage : le banc mesure des boîtes entières, qu'un parent peut couper à l'affichage. Pour chaque sélecteur
du code, `measure.mjs` remonte les blocs conteneurs ; si l'un a `overflow: hidden` ou `clip` (ou
`contain: paint`) et coupe la boîte de plus de 1 px, la ligne passe en `ÉCHEC` avec l'écart « rogné par
<balise.classe> » (jamais `OK`, aucune règle `assume` ne l'efface). Le test porte sur le code seulement, pas
sur la planche. Règles de la remontée :

- un ancêtre défilant (`overflow: auto` ou `scroll`) ne rogne pas, le contenu reste atteignable ; sa propre
  boîte remplace alors celle de l'élément pour les ancêtres suivants (choix prudent : un défilant plus grand
  que son parent hidden est signalé rogné, même si l'élément visé est dans la partie visible) ;
- un élément `absolute` n'est rogné que par les ancêtres de son bloc conteneur (premier ancêtre positionné,
  transformé, filtré ou `contain`), un élément `fixed` seulement par un ancêtre transformé, filtré ou `contain` ;
- `overflow-clip-margin` agrandit la zone d'un `overflow: clip` ; les ancêtres `display: inline`, `contents`
  ou de tableau (lignes, groupes) sont ignorés (`overflow` ne s'y applique pas) ;
- la remontée s'arrête à un dialogue modal ou un popover ouvert (calque supérieur) ;
- un descendant d'un bloc « sr-only » (1 px, `overflow: hidden`) est signalé rogné : ne jamais viser un tel
  descendant dans une spécification.

Limites connues : `clip-path`, `border-radius` et les masques ne sont pas pris en compte ; les rectangles des
ancêtres transformés (rotation) sont des boîtes englobantes ; le rognage par le document lui-même (`html`)
n'est pas signalé (défilement de page). Les cas vérifiés sont dans `fixtures/clip-cases.html`, testés par
`src/qa/fidelity/clip.test.js`, test facultatif sauté sans `FIDELITY_CHROMIUM`.

Sortie attendue pour `npm run fidelity -- E06` (viewport bureau 1440 x 900) : un seul `ÉCHEC`, le titre de page
mobile ME-19 (30 px planche, 26 px code, ST-03). La pastille « En cours » (ME-04) et la date de page
bureau sont en `OK`, les autres lignes ME-04, ME-06, ME-07 en `ASSUMÉ` (écarts mesurés et déclarés,
dont la liste ME-06 : y+3 et h-3, `A3`) ; les lignes avec 1 px non expliqué sont en `NON EXPLIQUÉ`.

## Structure

- `compare.mjs` : orchestration (CSS Tailwind, rendu, serveur local, mesures, rapport) et comparaison.
- `measure.mjs` : mesure d'une liste de sélecteurs dans une page.
- `vitest.fidelity.config.mjs`, `render.fidelity.jsx` : rendu statique des vues (`fixtures/*.js`).
- `fixtures/*.js` : données des planches ; chaque fichier exporte `screens` (nom, espace `e2` ou `c2`,
  chemin, module de la vue, composant, props). Le nom du rendu est repris par `screen` des spécifications.
- `specs/*.json` : une spécification par écran de planche.

## Spécification

```json
{
  "id": "E06", "title": "...", "planche": "etudiant/E06-messages.v2.html", "screen": "e06", "tolerance": 1,
  "assume": { "color": "A1", "bg": "A1", "fontSize": "A2:1" },
  "views": [{
    "name": "bureau", "viewport": [1440, 900], "frame": "desk", "frameIndex": 0,
    "assume": { "y": "A3:4" },
    "selectors": [
      { "id": "ME-06", "label": "liste", "board": ".e2-06-list", "code": ".e2-06-list",
        "props": ["x", "y", "w", "h", "radius", "bg"], "assume": { "h": "A3:4" }, "lot": "" }
    ]
  }]
}
```

- `frame` : `desk` (`.frame-desk__screen`, 1440) ou `phone` (`.frame-phone__screen`, 390 ; la barre
  d'état de 36 px est retranchée des y de la planche).
- `viewport` du code : 1440 x 900 pour tous les écrans bureau, la hauteur de la planche. La coquille v2
  du code (`min-height: 100dvh`) a un cadre de `100dvh - 32 px` et une zone principale de `100dvh - 60 px` ;
  la planche est un cadre de 900 px (900 - 32 et 900 - 60). À 900, les deux se superposent sans correctif.
- `board` : sélecteur dans le cadre de la planche ; `code` : sélecteur dans le rendu (défaut : `board`).
  Le premier élément correspondant est mesuré des deux côtés.
- `props` : `x y w h` (tolérance 1 px) et `tw` (largeur du texte lui-même, utile quand la boîte épouse un
  frère plus large ; à éviter sur les textes multilignes), `fontSize fontWeight fontFamily lineHeight color bg radius pad
  margin gap border shadow cols`.
- `assume` : écarts assumés par propriété, fusionnés spécification < vue < sélecteur. `A1` à `A9` sont
  les écarts du plan RD-FIDELITE-01 :
  A1 couleurs de la charte (vérifiées par correspondance exacte : encre, givre, ardoise, fond bleu clair, citron #C8F03C -> #C1EE3E), A2 taille minimale 13 px,
  A3 interligne des titres Anton 1.14 (`--lh-display` : 43,32 px de haut au lieu de 39,90 px, tout ce qui suit descend de 3,42 px réels, soit +3 ou +4 après arrondi), A4 logo de sidebar, A5 cibles tactiles
  44 px, A6 vouvoiement, A7 noms « Prénom N. », A8 omission décidée (D4 fonctions non codées, décision 24 achats : décalage causé par l'absence de l'élément, limite `A8:n` exacte et note obligatoires), A9 texte secondaire à 16 px (voir ci-dessous). Codes du banc : `BANC` valeur d'environnement absente du banc (par exemple `env(safe-area-inset-bottom)` vaut 0 dans Chromium headless), admis sur `h`, `y` et `pad` seulement, limite et note obligatoires ; autres codes : `L3` décalage vertical de la coquille
  mobile (lot 3, déclaré avec `lot`), `POLICE` écart de largeur dû à la police de repli, `X1` écart
  NON expliqué (le pixel reste visible : statut `NON EXPLIQUÉ`, compté à part, à résorber). Liste blanche :
  tout autre code (par exemple `A10`) est refusé au chargement. Syntaxe `"Ax:n"` : écart toléré jusqu'à n px
  (obligatoire pour les propriétés numériques et en px) ; `"A2+A3:5"` : cumul, tous les codes sont affichés ;
  `"Ax"` seul : écart de chaîne (couleur, famille...).
- `A9` : le texte secondaire est en 16 px (`--t-para`, décision RD-FIX-03 du projet) au lieu des 14 px des
  planches. Limité à `fontSize` et aux propriétés de boîte qui en découlent (`h`, `w`, `tw`) ; refusé sur toute
  autre propriété (une couleur, `y`...). Limite `A9:n` (valeur mesurée EXACTE) et `note` obligatoires, sinon la
  spécification est refusée au chargement. Cumulable comme A2 ou A3 (`"A8+A9:n"`), car une boîte peut cumuler
  une omission décidée et le changement de taille. À utiliser : un texte secondaire qui suit `--t-para` par
  décision RD-FIX-03 et dont l'écart de taille est mesuré. À NE PAS utiliser : pour un défaut, un texte dont la
  taille est fausse pour une autre raison, ni pour masquer un écart de position ou de couleur. Les ÉCHEC dus à
  une livraison différée ne se masquent par aucun code (A8 est réservé aux omissions décidées).
- `lot` : lot du plan qui corrige l'écart (information du rapport).
- `note` : explication des écarts du sélecteur (écart mesuré, cumul A2 + A3), reprise dans le rapport.
  Obligatoire dès qu'un sélecteur porte une règle `"Ax:n"` ; au niveau de la spécification ou de la vue,
  le champ `assumeNote` joue ce rôle. Le chargeur refuse une règle à limite sans note. Règle : la limite
  d'une règle `"Ax:n"` est la valeur mesurée EXACTE, par sélecteur ; un pixel non expliqué se déclare
  `X1`, jamais en élargissant la limite. Les `y` sont mesurés aussi en mobile.

Pour étendre : ajouter la fixture (données de la planche) puis le fichier de spécification, lancer
`npm run fidelity -- <ID>`, puis déclarer les écarts assumés justifiés.
