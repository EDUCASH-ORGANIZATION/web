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
- Optionnel : `FIDELITY_OUT` (défaut `/tmp/educash-fidelity`), `FIDELITY_MAQUETTES` (dossier des planches ; défaut : `design-rebrand/maquettes`, frère de `organization/`, résolu depuis la racine du dépôt, donc valable depuis `web/` et depuis `organization/web-*`).

## Utilisation

```
npm run fidelity -- E06              # un écran
npm run fidelity -- E06,E07,C12,C13  # plusieurs écrans
npm run fidelity -- E07 --report-only  # ne pas échouer sur les écarts
```

Sortie dans `$FIDELITY_OUT/<ID>/` : `planche-bureau.png`, `code-bureau.png`, `planche-mobile.png`,
`code-mobile.png`, `rapport.md`, `rapport.json`. Le rapport est aussi écrit sur la sortie standard :
tableau Élément / Planche / Code / Écart / Statut, avec le statut `OK`, `ASSUMÉ Ax` (tous les codes appliqués,
par exemple `ASSUMÉ A2, A3`), `ASSUMÉ-POLICE` (police seule), `NON EXPLIQUÉ ... X1` ou `ÉCHEC`. Le récapitulatif compte
à part chaque statut ; un statut mixte `ASSUMÉ A3, POLICE` est compté dans ASSUMÉ (rappelé par « dont avec POLICE »).
Code de sortie 1 s'il reste un `ÉCHEC` (sauf `--report-only`), 2 en cas d'erreur du banc.

Sortie attendue pour `npm run fidelity -- E06` : toutes les lignes ME-04, ME-06, ME-07 en `ASSUMÉ` (écarts
mesurés et déclarés), sauf la pastille « En cours » (ME-04, lot ST-04, filtre inexistant), la date de page
bureau (contenu « Jeudi 8 octobre · » absent du code) et le titre mobile (30 px planche, 26 px code), qui
restent en `ÉCHEC` ; les lignes avec 1 px non expliqué sont en `NON EXPLIQUÉ`.

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
    "name": "bureau", "viewport": [1440, 880], "frame": "desk", "frameIndex": 0,
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
- `viewport` du code : la hauteur 880 aligne la coquille du code (`100vh - 40 px`) sur le cadre de la
  planche (900 - 60 px).
- `board` : sélecteur dans le cadre de la planche ; `code` : sélecteur dans le rendu (défaut : `board`).
  Le premier élément correspondant est mesuré des deux côtés.
- `props` : `x y w h` (tolérance 1 px) et `tw` (largeur du texte lui-même, utile quand la boîte épouse un
  frère plus large ; à éviter sur les textes multilignes), `fontSize fontWeight fontFamily lineHeight color bg radius pad
  margin gap border shadow cols`.
- `assume` : écarts assumés par propriété, fusionnés spécification < vue < sélecteur. `A1` à `A7` sont
  les écarts du plan RD-FIDELITE-01 :
  A1 couleurs de la charte (vérifiées par correspondance exacte), A2 taille minimale 13 px,
  A3 interligne des titres (tout ce qui suit descend de 3 px), A4 logo de sidebar, A5 cibles tactiles
  44 px, A6 vouvoiement, A7 noms « Prénom N. ». Codes du banc : `L3` décalage vertical de la coquille
  mobile (lot 3, déclaré avec `lot`), `POLICE` écart de largeur dû à la police de repli, `X1` écart
  NON expliqué (le pixel reste visible : statut `NON EXPLIQUÉ`, compté à part, à résorber). Liste blanche :
  tout autre code (par exemple `A9`) est refusé au chargement. Syntaxe `"Ax:n"` : écart toléré jusqu'à n px
  (obligatoire pour les propriétés numériques et en px) ; `"A2+A3:5"` : cumul, tous les codes sont affichés ;
  `"Ax"` seul : écart de chaîne (couleur, famille...).
- `lot` : lot du plan qui corrige l'écart (information du rapport).
- `note` : explication des écarts du sélecteur (écart mesuré, cumul A2 + A3), reprise dans le rapport.
  Obligatoire dès qu'un sélecteur porte une règle `"Ax:n"` ; au niveau de la spécification ou de la vue,
  le champ `assumeNote` joue ce rôle. Le chargeur refuse une règle à limite sans note. Règle : la limite
  d'une règle `"Ax:n"` est la valeur mesurée EXACTE, par sélecteur ; un pixel non expliqué se déclare
  `X1`, jamais en élargissant la limite. Les `y` sont mesurés aussi en mobile.

Pour étendre : ajouter la fixture (données de la planche) puis le fichier de spécification, lancer
`npm run fidelity -- <ID>`, puis déclarer les écarts assumés justifiés.
