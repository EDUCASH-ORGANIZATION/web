import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { parseColorTokens, contrastRatio } from "@/lib/design/contrast"

// Garde-fou des feuilles v2.1 (RD-CLIENT-01 ST-01) : coquille connectee
// (app-shell.css) et espace client (client.css + client/*.css).

const dir = import.meta.dirname
const read = (rel) => readFileSync(path.join(dir, rel), "utf8")
// Bloc @media ou @container (un niveau de regles imbriquees) : retire du « premier niveau » des feuilles.
const AT_BLOCK = /@(?:media|container)[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "")

const CLIENT_FILES = readdirSync(path.join(dir, "client")).filter((f) => f.endsWith(".css")).sort()
const SHELL = stripComments(read("app-shell.css"))
const CLIENT = CLIENT_FILES.map((f) => stripComments(read(`client/${f}`))).join("\n")
const ALL = `${SHELL}\n${CLIENT}`
const DESIGN_CSS = ["tokens.css", "components.css", "layouts.css", "app-shell.css", "client.css", ...CLIENT_FILES.map((f) => `client/${f}`)]

// Classes des sources (shell-v2.css et fragments v2-client), au renommage ds- pres,
// moins les classes volontairement non portees (REMOVED, avec la raison).
const SHELL_SOURCE_CLASSES = `
agenda2 app2 av2 av2--sm bnav-item bnav-item__dot bnav2 bnav2__count bnav2__item bottom-nav--v2
btn--blanc btn--block btn--sidebar btn--soft cal2 cal2__day cal2__dow cal2__grid cal2__head
cal2__legend cal2__month card2 card2--m count day2 day2--m day2__count day2__head day2__name
duo2 flag2 flag2--neutre has-due head2 head2__date head2__title hero2 hero2--m hero2__actions
hero2__col hero2__figure hero2__label hero2__link hero2__meta hero2__text hero2__title ic
iconbtn2 iconbtn2__dot is-active is-focus is-hover is-out is-today item2 item2__action item2__ic
item2__meta item2__sub item2__title list2 list2--m list2__head list2__more list2__title
logo-sym main2 mapp2 money2 money2--m money2--split money2__head mpage2 mtop2 mtop2__space nav-item nav2 nav2__count page2 row2 search2 shell--v2 shell__main side2 side2__brand side2__cta
side2__foot side2__group side2__me side2__space sidebar__brand sidebar__group sidebar__me
sidebar__space skel2-hero skel2-row skel2-stats slot2 stat2 stat2__label stat2__sub stat2__value
stats2 stats2--m step2 step2--done top2 top2__actions top2__stamp v2-tag week2 week2__d
`.trim().split(/\s+/)

const CLIENT_SOURCE_CLASSES = `
actions2 actions2--end amount amount-chips2 applicant applicant--accepted applicant__band av2
avatar avatar--ring badge balance__scribble banner banner--alerte banner--citron banner--encre
banner--erreur banner__actions banner__body bento-card__shape btn btn--accent btn--blanc btn--danger-outline btn--dark btn--ghost btn--ghost-blanc btn--primary btn--secondary btn--soft btn-icon btn-icon--sm btn-icon__dot bubble bubble--me bubble--them bubble__meta buy2 buy2__sub
buy2__title c-inbox c-inbox__head c-inbox__list c-inbox__thread c-payreq c-payreq--flagged
c-payreq__actions c-payreq__head c-payreq__total c-payreq__warn c-shot c-shot__sign c-shot__sign--perso c-shot__sms c2 cand2 cand2--m cand2--muted cand2__acts cand2__msg cand2__msg--clamp
cand2__top caption card card--citron card--citron-pale card--givre card--hl card--lavande card--link card--menthe card--peche card--rose card2--flush card2--m chat chat-status chat__day check
checklist chip chips choice choice__mark col2 col2--m composer composer__field composer__send
control convo convo__mission convo__name convos2 count count--citron count--neutre detail-card
detail-card--citron detail-card--menthe detail-card__name detail-head__actions disabled2 divider
done2 done2__mark done2__mark--alerte done2__mark--erreur done2__text done2__title drawer
drawer__body drawer__foot drawer__head ds-grid--3 ds-table ds-table-wrap e-success__mark
e-success__mark--alerte e-success__mark--erreur empty--erreur empty--sm empty2 empty2--sm
empty2__ic empty2__ic--erreur empty2__text empty2__title empty__art empty__title eyebrow2 facts2
field-grid2 field__count file file--error file__thumb filters2 filters2--m filters2__sep flag2
form2 form2__foot form2__foot--split fund2 fund2__amt fund2__sub fund2__title hero2__link ic ic-sq ic-sq--alerte ic-sq--blanc ic-sq--bleu ic-sq--citron ic-sq--encre ic-sq--erreur ic-sq--lavande ic-sq--menthe ic-sq--rose ic-sq--succes inbox2 inbox2--tall inbox2__empty input is-active is-checked is-current is-disabled is-done is-error is-failed is-full is-hover is-loading
is-ok is-on is-selected is-unread item2--mission item2--muted item2__amount item2__cell
item2__head item2__ic item2__late item2__line item2__sub item2__title kv lead2 lines2
lines2__row lines2__row--total link2 link2--danger link2--muted list2__foot list2__head lrow
lrow--citron lrow--lavande lrow--menthe lrow--peche lrow__ic mapp2 mbar2 mbar2__note mbar2__row
mchat2 me2 me2__name me2__sub menu meta2 mission mission--hl mission--link mission__foot modal
modal--danger modal__body modal__title money2 money2--m money2__foot money2__hint mpage2 mpage2--bar msg-system mstep2 mtop2--chat mtop2__who note2 note2--box notif payer payreq2__note
person2 person2--lg person2__acts person2__name person2__sub preview2 preview2__price
preview2__title preview2__top prof2__h prof2__p prof2__p--encre progress progress2 quote2
quote2__top radio radios2 rate2 rate2__label rate2__label--muted recap recap__total review2
review2x review2x__stars review2x__top scribble scrim search sec2 sec2__more sec2__title
segmented segmented__item select sheet skel-card split2 split2--wide stars--input stat2
stat2__value stats2 stats2--2x2 stats2--3s stats2--4 status2 status2__text status2__title step
step__dot step__label step__line stepper steps2 sticker sub2 switch t-paycard tab ds-table-wrap__foot ds-table-wrap__head tabs tabs2 tags2 tcard tl-item tl-item__dot toast toast--erreur
toast--succes toast__action toast__icon tools2 tools2__count tx2 tx2--m tx2__amt tx2__date
tx2__sub tx2__title underline-scribble upload v-achats v-achats__est v-achats__head
v-achats__step v-achats__step--citron v-achats__sub wizard2
`.trim().split(/\s+/)

const WHY_MEDIA = "variante --m des planches (DOM mobile separe), remplacee par les media queries sur les classes de base"
const WHY_AGENDA = "agenda et calendrier C18, hors perimetre de RD-CLIENT-01"
const REMOVED = {
  "v2-tag": "legende de planche, jamais rendue dans l'app",
  mapp2: "gabarit mobile des planches : la coquille reelle est .shell--v2 / .app2 avec media queries",
  "hero2--m": WHY_MEDIA, "stats2--m": WHY_MEDIA, "list2--m": WHY_MEDIA, "money2--m": WHY_MEDIA,
  "card2--m": WHY_MEDIA, "cand2--m": WHY_MEDIA, "col2--m": WHY_MEDIA, "tx2--m": WHY_MEDIA, "filters2--m": WHY_MEDIA,
  "day2--m": WHY_MEDIA,
  agenda2: WHY_AGENDA, cal2: WHY_AGENDA, cal2__day: WHY_AGENDA, cal2__dow: WHY_AGENDA, cal2__grid: WHY_AGENDA,
  cal2__head: WHY_AGENDA, cal2__legend: WHY_AGENDA, cal2__month: WHY_AGENDA, day2: WHY_AGENDA, day2__count: WHY_AGENDA,
  day2__head: WHY_AGENDA, day2__name: WHY_AGENDA, week2: WHY_AGENDA, week2__d: WHY_AGENDA, slot2: WHY_AGENDA,
  "has-due": WHY_AGENDA, "is-today": WHY_AGENDA, "is-out": WHY_AGENDA,
}
const SHELL_CLASSES = SHELL_SOURCE_CLASSES.filter((c) => !(c in REMOVED))
const CLIENT_CLASSES = CLIENT_SOURCE_CLASSES.filter((c) => !(c in REMOVED))

const hasClass = (css, name) => new RegExp(`\\.${name.replace(/[-_]/g, "[-_]")}(?![\\w-])`).test(css)

// Noms d'utilitaires Tailwind : jamais utilisables comme classe nue du systeme.
const TAILWIND_BARE = new Set([
  "grid", "grow", "table", "table-wrap", "h3", "container", "block", "flex", "hidden", "inline",
  "inline-block", "static", "fixed", "absolute", "relative", "sticky", "truncate", "border",
  "shadow", "ring", "transition", "transform", "filter", "blur", "outline", "underline",
  "uppercase", "lowercase", "capitalize", "italic", "invisible", "visible", "contents",
  "collapse", "resize", "sr-only", "prose", "content", "isolate", "overflow", "rounded",
])

function selectorsOf(css) {
  const out = []
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1].trim()
    // Les etapes d'un @keyframes (from, to, 40 %) ne sont pas des selecteurs de regle.
    if (!sel.startsWith("@") && !/^(?:from|to|\d+%)$/.test(sel)) out.push(sel)
  }
  return out
}

function classNamesOf(css) {
  const names = new Set()
  for (const sel of selectorsOf(css)) for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) names.add(m[1])
  return names
}

// Classe propre aux nouvelles feuilles : suffixe 2 ou --v2, ou extension nommee du systeme.
const NEW_CLASS = /(?:2(?:x|-[a-z]+)?(?:__[\w-]+|--[\w-]+)?|--v2)$/
const NEW_SYSTEM = new Set([
  "btn--soft", "btn--sidebar", "btn--blanc", "btn--ghost-blanc", "sidebar__me",
  "ds-toasts-fixed", "ds-toasts__zone", "ds-drawer--full", "ds-stars__btn",
])
const isNew = (c) => NEW_CLASS.test(c) || NEW_SYSTEM.has(c)

/** font-size en em, rem ou % inferieure a 1 qui n'est pas dans un max() avec var(--t-micro) en premier argument. */
function relativeSizeOffenders(css) {
  const out = []
  for (const m of css.matchAll(/font-size:\s*([^;}]+)/g)) {
    const value = m[1].trim()
    if (/^max\(\s*var\(--t-micro\)\s*,[^)]*\)$/.test(value)) continue
    const units = [...value.matchAll(/(-?[\d.]+)(em|rem|%)(?![\w-])/g)]
    if (units.some(([, n, u]) => Number(n) < (u === "%" ? 100 : 1))) out.push(value)
  }
  return out
}

describe("feuilles app-shell.css et client/*.css", () => {
  it("ne contiennent plus les classes retirees (planches, --m, agenda C18), chacune documentee dans REMOVED", () => {
    const leftovers = Object.keys(REMOVED).filter((c) => hasClass(ALL, c))
    expect(leftovers).toEqual([])
    for (const reason of Object.values(REMOVED)) expect(reason.length).toBeGreaterThan(10)
  })

  it("contiennent chaque classe de shell-v2.css et des fragments v2-client", () => {
    const missingShell = SHELL_CLASSES.filter((c) => !hasClass(ALL, c))
    const missingClient = CLIENT_CLASSES.filter((c) => !hasClass(ALL, c))
    expect(missingShell).toEqual([])
    expect(missingClient).toEqual([])
  })

  it("appliquent les renommages ds- (table, table-wrap, grid) et la portee .c2", () => {
    expect(ALL).toContain(".c2 .ds-table-wrap")
    expect(ALL).toContain(".c2 .ds-table th")
    expect(ALL).toContain(".form2 .ds-grid--3")
    expect(ALL).not.toMatch(/\.table(?![\w-])/)
    expect(ALL).not.toMatch(/\.grid--/)
    expect(CLIENT).toMatch(/\.c2 \.btn--primary/)
  })

  it("ne contiennent aucune couleur en dur (hex, rgb, rgba, hsl) ni de nom de couleur CSS nu", () => {
    expect(ALL).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(ALL).not.toMatch(/\b(?:rgba?|hsla?)\(/)
    expect(ALL).not.toMatch(/:\s*(?:white|black|red|green|blue)\s*[;}]/)
  })

  it("n'utilisent que des variables definies dans les feuilles du systeme", () => {
    const defined = new Set()
    for (const f of DESIGN_CSS) for (const m of read(f).matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1])
    const used = new Set([...ALL.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))
    expect([...used].filter((v) => !defined.has(v))).toEqual([])
  })

  it("ne dependent plus de frames.css (hauteur fixe, positions absolues de la barre du bas)", () => {
    expect(ALL).not.toContain("900px")
    expect(ALL).toMatch(/min-height: 100dvh/)
    expect(SHELL).toMatch(/\.bnav2 \{[^}]*position: fixed[^}]*env\(safe-area-inset-bottom/)
    expect(CLIENT).toMatch(/\.mbar2 \{[^}]*position: fixed/)
    expect(SHELL).not.toMatch(/\.bnav2 \{[^}]*position: absolute/)
  })

  it("ne reutilisent aucun nom d'utilitaire Tailwind comme classe", () => {
    const names = [...classNamesOf(ALL)]
    expect(names.filter((n) => TAILWIND_BARE.has(n))).toEqual([])
    expect(names.filter((n) => /^-?(?:m|p|w|h|gap|space|text|bg|border|rounded|col|row)[trblxy]?-\d/.test(n))).toEqual([])
  })

  it("garde chaque regle hors .c2 sur des classes nouvelles (aucun changement de rendu des pages existantes)", () => {
    const offenders = []
    for (const sel of selectorsOf(ALL)) {
      for (const part of sel.split(",").map((p) => p.trim())) {
        if (part.startsWith(".c2 ") || part === ".c2") continue
        const names = [...part.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1])
        if (!names.some(isNew)) offenders.push(part)
      }
    }
    expect(offenders).toEqual([])
  })

  it("n'utilise que les seuils de media query 1023.98, 767.98 et 480 (plus le mouvement reduit)", () => {
    const conditions = [...ALL.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim())
    const allowed = ["(max-width: 1023.98px)", "(max-width: 767.98px)", "(max-width: 480px)", "(prefers-reduced-motion: reduce)"]
    expect(conditions.length).toBeGreaterThan(0)
    expect(conditions.filter((c) => !allowed.includes(c))).toEqual([])
    for (const a of allowed) expect(conditions).toContain(a)
  })

  // Les requetes de conteneur sont AUTORISEES, et seulement celles-ci : la lisibilite d'une carte depend de la
  // largeur de la carte (ex. 332 px pour l'historique d'un bureau de 1024-1149 px avec sidebar), pas de celle de
  // l'ecran, et le garde-fou des media queries interdit tout seuil de largeur d'ecran supplementaire. Le controle
  // des media queries ci-dessus reste inchange.
  // C03 (publication) ajoute une requete de conteneur anonyme (520 px) sur .wizard2__choices2 : les cartes d'urgence
  // passent a trois colonnes selon la largeur du champ, pas celle de l'ecran.
  // C03 (publication) ajoute une requete de conteneur nommee wizard2card (400 px) sur la carte du formulaire
  // (.wizard2 .form2) : le <dl class="review2"> du recapitulatif passe de une colonne (libelles au-dessus des valeurs)
  // a deux colonnes 160 px + 1fr quand le contenu de la carte atteint 400 px.
  // C17 (profil) : la colonne principale (.profile2 .col2, conteneur profile2col) mesure environ 330 px entre 1024 et
  // 1150 px d'ecran (colonne = ecran - 693 px) : deux requetes, 480 px (identite empilee) et 720 px (chiffres sur 2 colonnes).
  it("n'utilise que les requetes de conteneur txs2 (600 px), money2 (480 px), profile2col (480 et 720 px) et celles de C03 : cartes d'urgence (520 px) et carte du formulaire wizard2card (400 px)", () => {
    const conditions = [...ALL.matchAll(/@container\s*([^{]+)\{/g)].map((m) => m[1].trim())
    expect(conditions.sort()).toEqual([
      "(min-width: 520px)", "money2 (max-width: 480px)", "profile2col (max-width: 480px)", "profile2col (max-width: 720px)", "txs2 (max-width: 600px)",
      "wizard2card (min-width: 400px)",
    ])
    expect(ALL).not.toMatch(/@media[^{]*\bmin-width/)
  })

  it("range les regles mobiles apres les regles de base de leur propre fichier", () => {
    for (const css of [SHELL, ...CLIENT_FILES.map((f) => stripComments(read(`client/${f}`)))]) {
      const firstMedia = css.indexOf("@media")
      if (firstMedia === -1) continue
      const rest = css.slice(firstMedia)
      const outside = rest.replace(AT_BLOCK, "")
      expect(outside.trim()).toBe("")
    }
  })

  it("n'utilise aucune font-size en px inferieure a 13 (minimum absolu --t-micro) dans app-shell et client", () => {
    const sizes = [...ALL.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
    expect(sizes.length).toBeGreaterThan(0)
    expect(sizes.filter((px) => px < 13)).toEqual([])
  })

  it("protege toute font-size relative (em, rem, %) inferieure a 1 par max(var(--t-micro), ...)", () => {
    expect(relativeSizeOffenders(ALL)).toEqual([])
    expect(SHELL).toContain("font-size: max(var(--t-micro), .36em)")
    expect(SHELL).toContain("font-size: max(var(--t-micro), .55em)")
  })

  it("le detecteur de font-size relative refuse un em nu et accepte un max() protege", () => {
    expect(relativeSizeOffenders(".a small { font-size: .36em; }")).toHaveLength(1)
    expect(relativeSizeOffenders(".a { font-size: 80%; }")).toHaveLength(1)
    expect(relativeSizeOffenders(".a { font-size: .9rem; }")).toHaveLength(1)
    expect(relativeSizeOffenders(".a { font-size: max(.36em, 10px); }")).toHaveLength(1)
    expect(relativeSizeOffenders(".a { font-size: max(var(--t-micro), .36em); }")).toEqual([])
    expect(relativeSizeOffenders(".a { font-size: 1.2em; }")).toEqual([])
  })

  it("reporte les regles utiles des variantes --m (onglets C14 filtres, onglets .c2)", () => {
    const base = stripComments(read("client/base.css"))
    expect(base).toMatch(/\.c2 \.tabs \{ gap: var\(--s-5\); \}/)
    const c14 = stripComments(read("client/c14.css"))
    const phone = c14.slice(c14.indexOf("@media (max-width: 767.98px)"))
    expect(phone).toMatch(/\.filters2 \{[^}]*padding: 0 0 2px; border: 0;[^}]*mask-image: linear-gradient/)
  })

  it("toasts mobiles au-dessus de .mbar2 sur les ecrans de detail, anneau sombre generique sur .money2", () => {
    expect(SHELL).toMatch(/\.shell--detail \.toasts--mobile\.ds-toasts-fixed \{ bottom: calc\(140px/)
    expect(SHELL).toMatch(/\n\.shell--v2:has\(\.mbar2\) \.toasts--mobile\.ds-toasts-fixed \{ bottom: calc\(140px/)
    expect(SHELL).toMatch(/\.money2 \.btn:focus-visible, \.money2 \.btn-icon:focus-visible \{ box-shadow: var\(--sh-focus-sombre\)/)
    expect(SHELL).toMatch(/\.c2 \*::before, \.c2 \*::after[^}]*scroll-behavior: auto !important[^}]*animation-duration: \.01ms !important/)
  })

  it("garde les logos aux minimums de la charte, sur les VRAIES classes (sidebar__brand, mtop2)", () => {
    expect(SHELL).toMatch(/\.mtop2 \.logo-sym \{ height: 32px; width: auto; \}/)
    // La sidebar reelle est .sidebar__brand > img.logo (layouts.css : 40 px de haut, >= 37), largeur >= 150 px.
    const logoRule = stripComments(read("layouts.css")).match(/\n\.logo \{([^}]*)\}/)?.[1] ?? ""
    expect(Number(logoRule.match(/height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(37)
    expect(SHELL).not.toMatch(/\.sidebar__brand[^{]*\.logo[^{]*\{[^}]*height:\s*(?:[0-2]\d|3[0-6])px/)
    const sidebar = readFileSync(path.join(dir, "..", "..", "components", "app-shell", "sidebar.jsx"), "utf8")
    expect(sidebar).toContain('className="sidebar__brand"')
    expect(Number(sidebar.match(/<img className="logo"[^>]*width=\{(\d+)\}/)?.[1])).toBeGreaterThanOrEqual(150)
    expect(SHELL).not.toContain(".side2__brand .logo")
  })

  it("garde les montants a 7 chiffres dans 3 colonnes : taille fluide jamais sous 13 px, unite a la ligne", () => {
    const phone = SHELL.slice(SHELL.indexOf("@media (max-width: 767.98px)"))
    expect(phone).toMatch(/\.stats2 \.stat2__value, \.money2--split \.stat2__value \{ font-size: max\(var\(--t-micro\), clamp\(13px, [\d.]+vw, var\(--t-amount-s\)\)\); \}/)
    expect(phone).toMatch(/\.stats2 \.stat2__value small, \.money2--split \.stat2__value small \{ display: block;/)
  })

  it("laisse un montant de 10 chiffres passer a la ligne dans sa cellule au lieu de deborder, sans reduire la taille", () => {
    const phone = SHELL.slice(SHELL.indexOf("@media (max-width: 767.98px)"))
    expect(phone).toMatch(/\.stats2 \.stat2__value, \.money2--split \.stat2__value \{ min-width: 0; white-space: normal; overflow-wrap: anywhere; \}/)
    expect(SHELL).toMatch(/\.stat2 \{[^}]*min-width: 0;/)
  })

  it("durcit la coquille : pastille 20 px, libelles tronques, avatar image rogne, formulaire de recherche et .search2 sans debordement", () => {
    // Capsule RD-NAV-02 : pastille 20 px (au moins), items de 44 px minimum (cible tactile), libelle tronque par ellipse
    // dans un flex qui peut se contracter (min-width: 0), jamais de debordement de la capsule.
    expect(SHELL).toMatch(/\.bottom-nav--v2 \.bnav-item__dot \{[^}]*min-width: 20px; height: 20px;/)
    expect(SHELL).toMatch(/\.bottom-nav--v2 \.bnav-item \{[^}]*min-width: 44px; height: 48px;/)
    expect(SHELL).toMatch(/\.bottom-nav--v2 \.bnav-label \{ min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;/)
    expect(SHELL).toContain(".c2 .av2 { overflow: hidden; }")
    expect(SHELL).toContain(".c2 .av2 img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }")
    expect(SHELL).toContain(".shell--v2 .top2 form { flex: 0 1 auto; min-width: 0; }")
    expect(SHELL).toMatch(/\.search2 \{[^}]*width: 440px; max-width: 100%;/)
  })

  it("donne a .head2__title l'interligne des titres Anton", () => {
    expect(SHELL).toMatch(/\.head2__title \{[^}]*line-height: var\(--lh-display\)/)
  })

  it("barre du bas .bottom-nav--v2 (capsule RD-NAV-02) : masquee au bureau, capsule flex fixe avec safe-area sous 1024, bnav2 conservee", () => {
    expect(SHELL).toMatch(/\.bottom-nav--v2 \{ display: none; \}/)
    // Actif : pastille citron, texte encre (11,84:1). Remplace l'actif blanc de la barre precedente.
    expect(SHELL).toMatch(/\.bottom-nav--v2 \.bnav-item\.is-active \{[^}]*background: var\(--c-citron\); color: var\(--c-encre\);/)
    expect(SHELL).not.toMatch(/\.bottom-nav--v2 \.bnav-item\.is-active \{[^}]*background: var\(--c-blanc\)/)
    expect(SHELL).toMatch(/\.bottom-nav--v2 \.bnav-item__dot \{/)
    const tablet = SHELL.slice(SHELL.indexOf("@media (max-width: 1023.98px)"))
    // Remplace `display: grid` : la capsule est un flex (actif de largeur libre, inactifs en icones).
    expect(tablet).toMatch(/\.bottom-nav\.bottom-nav--v2 \{[^}]*display: flex[^}]*position: fixed[^}]*left: 10px; right: 10px; bottom: calc\(14px \+ env\(safe-area-inset-bottom/)
    expect(tablet).toMatch(/\.bottom-nav\.bottom-nav--v2 \{[^}]*height: var\(--h-bottomnav\)[^}]*border-radius: var\(--r-pill\); background: var\(--c-encre\); box-shadow: var\(--sh-dur-s\); z-index: var\(--z-nav\)/)
    expect(tablet).not.toMatch(/\.bottom-nav\.bottom-nav--v2 \{[^}]*display: grid/)
    expect(tablet).toMatch(/\.shell--v2 \.shell__main \{ padding: 0 var\(--s-4\) calc\(86px \+ env\(safe-area-inset-bottom/)
    expect(tablet).toMatch(/\.main2 \{ padding-bottom: calc\(86px \+ env\(safe-area-inset-bottom/)
    expect(SHELL).toMatch(/\.bnav2 \{[^}]*position: fixed/)
  })

  it("capsule : couleurs par tokens seulement, aucun hex dans le bloc de la barre, anneau de focus --sh-focus", () => {
    const bar = SHELL.slice(SHELL.indexOf(".bottom-nav--v2 { display: none; }"), SHELL.indexOf(".c2 .av2 { overflow: hidden; }"))
    expect(bar.length).toBeGreaterThan(500)
    expect(bar).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/)
    expect(bar).toMatch(/\.bottom-nav--v2 \.bnav-item:focus-visible, \.bnav2-more__link:focus-visible \{ outline: 2px solid transparent; box-shadow: var\(--sh-focus\); \}/)
    expect(bar).toContain("color-mix(in srgb, var(--c-blanc) 8%, transparent)")
    expect(bar).not.toMatch(/box-shadow:[^;]*blur|\d+px \d+px \d+px/)
  })

  it("capsule : l'onglet actif gagne la cascade (citron, encre, 13 px) contre .bnav-item de layouts.css, l'inactif reste brume", () => {
    const ancestors = ["ds", "c2", "shell", "shell--v2", "shell__main", "bottom-nav", "bottom-nav--v2"]
    const active = computedStyle(RULES, { tag: "a", classes: ["bnav-item", "is-active"], ancestors })
    expect(active.background).toBe("var(--c-citron)")
    expect(active.color).toBe("var(--c-encre)")
    expect(active["font-size"]).toBe("var(--t-micro)")
    expect(active["min-width"]).toBe("44px")
    expect(active.flex).toBe("0 1 auto")
    expect(active.margin).toBe("0")
    const hover = computedStyle(RULES, { tag: "a", classes: ["bnav-item", "is-active"], ancestors, states: ["hover"] })
    expect(hover.background).toBe("var(--c-citron-600)")
    expect(hover.color).toBe("var(--c-encre)")
    const idle = computedStyle(RULES, { tag: "a", classes: ["bnav-item"], ancestors })
    expect(idle.color).toBe("var(--c-brume)")
    expect(idle.background).toBe("transparent")
    expect(idle["min-width"]).toBe("44px")
    expect(idle.height).toBe("48px")
    expect(idle["font-size"]).toBe("var(--t-micro)")
    const idleHover = computedStyle(RULES, { tag: "button", classes: ["bnav-item"], ancestors, states: ["hover"] })
    expect(idleHover.color).toBe("var(--c-blanc)")
    expect(idleHover.background).toBe("color-mix(in srgb, var(--c-blanc) 8%, transparent)")
    const press = computedStyle(RULES, { tag: "a", classes: ["bnav-item"], ancestors, states: ["active"] })
    expect(press.transform).toBe("scale(.94)")
    const focus = computedStyle(RULES, { tag: "a", classes: ["bnav-item"], ancestors, states: ["focus-visible"] })
    expect(focus["box-shadow"]).toBe("var(--sh-focus)")
  })

  it("capsule : pastille de non lus corail (--c-erreur-sombre) a chiffre encre, 13 px, bordure de la couleur du fond", () => {
    const ancestors = ["ds", "c2", "shell", "shell--v2", "shell__main", "bottom-nav", "bottom-nav--v2"]
    const dot = computedStyle(RULES, { tag: "i", classes: ["bnav-item__dot"], ancestors })
    expect(dot.background).toBe("var(--c-erreur-sombre)")
    expect(dot.color).toBe("var(--c-encre)")
    expect(dot["font-size"]).toBe("var(--t-micro)")
    expect(dot.border).toBe("2px solid var(--c-encre)")
    const onActive = computedStyle(RULES, { tag: "i", classes: ["bnav-item__dot"], ancestors: [...ancestors, "bnav-item", "is-active"] })
    expect(onActive["border-color"]).toBe("var(--c-citron)")
  })

  it("capsule : meme police que la racine .ds (--f-text), y compris dans les espaces etudiant et admin sans .ds", () => {
    const ds = read("components.css")
    const dsFont = ds.match(/^\.ds \{[^}]*font-family: ([^;]+);/m)[1]
    expect(dsFont).toBe("var(--f-text)")
    expect(SHELL).toContain(".bottom-nav--v2, .bnav2-more__panel { font-family: var(--f-text); }")
    // --f-text vient de la variable next/font Figtree, posee sur <html> par le layout racine (donc presente dans tous les espaces).
    const tokens = read("tokens.css")
    expect(tokens).toMatch(/--f-text: var\(--font-figtree\)/)
    const root = readFileSync(path.join(dir, "..", "layout.js"), "utf8")
    expect(root).toMatch(/variable: "--font-figtree"/)
    expect(root).toMatch(/<html [^>]*\$\{figtree\.variable\}/)
  })

  it("capsule : Plus (panneau encre, ombre dure, liens de 48 px, actif citron), espaceur masque hors media et dimensionne sous 1024", () => {
    expect(SHELL).toMatch(/\.bnav2-more \{ display: flex; flex: 1 1 0; min-width: 44px; \}/)
    expect(SHELL).toMatch(/\.bnav2-more__panel \{[^}]*bottom: calc\(100% \+ var\(--s-2\)\)[^}]*background: var\(--c-encre\); box-shadow: var\(--sh-dur-s\); z-index: var\(--z-menu\);/)
    // Le panneau flotte au-dessus de la CAPSULE (position: fixed, ancre) avec 8 px d'espace : le wrapper .bnav2-more ne doit pas etre ancre.
    expect(SHELL).not.toMatch(/\.bnav2-more \{[^}]*position: relative/)
    expect(SHELL).toMatch(/\.bnav2-more__panel \{ position: absolute; right: 0; bottom: calc\(100% \+ var\(--s-2\)\);/)
    expect(SHELL).toMatch(/\.bottom-nav\.bottom-nav--v2 \{[^}]*position: fixed/)
    // L'attribut hidden doit gagner contre display: flex du panneau (le panneau est ferme au rendu initial).
    expect(SHELL).toContain(".bnav2-more__panel[hidden] { display: none; }")
    expect(SHELL).toMatch(/\.bnav2-more__link \{[^}]*min-height: 48px;[^}]*color: var\(--c-brume\); font-size: var\(--t-micro\);/)
    expect(SHELL).toMatch(/\.bnav2-more__link\[aria-current="page"\] \{ background: var\(--c-citron\); color: var\(--c-encre\); \}/)
    expect(SHELL).toContain(".bnav2-spacer { display: none; }")
    const tablet = SHELL.slice(SHELL.indexOf("@media (max-width: 1023.98px)"))
    expect(tablet).toContain(".bnav2-spacer { display: block; height: calc(86px + env(safe-area-inset-bottom, 0px) + var(--s-6)); }")
    expect(SHELL.indexOf(".bnav2-spacer { display: none; }")).toBeLessThan(SHELL.indexOf("@media (max-width: 1023.98px)"))
  })

  it("capsule plafonnee et centree entre 481 et 1023 px, sans nouveau seuil ; toasts mobiles au-dessus du bouton Publier", () => {
    const tablet = SHELL.slice(SHELL.indexOf("@media (max-width: 1023.98px)"))
    expect(tablet).toMatch(/\.bottom-nav\.bottom-nav--v2 \{[^}]*left: 10px; right: 10px;[^}]*max-width: 520px; margin: 0 auto;/)
    // Le plafond ne doit pas passer sous la largeur utile a 320 px (300 px) ni depasser une capsule lisible.
    const cap = Number(tablet.match(/\.bottom-nav\.bottom-nav--v2 \{[^}]*max-width: (\d+)px/)[1])
    expect(cap).toBeGreaterThanOrEqual(480)
    expect(cap).toBeLessThanOrEqual(560)
    // Toasts : plus d'air que l'ancien 86 + s-3 (12 px), qui touchait l'anneau du bouton central (~14 px de depassement).
    expect(SHELL).toMatch(/\.toasts--mobile\.ds-toasts-fixed \{ bottom: calc\(86px \+ env\(safe-area-inset-bottom, 0px\) \+ var\(--s-6\)\); \}/)
    expect(SHELL).not.toMatch(/\.toasts--mobile\.ds-toasts-fixed \{ bottom: calc\(86px \+ env\(safe-area-inset-bottom, 0px\) \+ var\(--s-3\)\)/)
  })

  it("capsule : bouton Publier central (52 px, bleu, icone blanche >= 4,5:1, souleve, sans libelle) avec anneau citron actif et focus visible", () => {
    const colors = parseColorTokens(read("tokens.css"))
    expect(contrastRatio(colors["--c-blanc"], colors["--c-bleu"])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors["--c-blanc"], colors["--c-bleu-700"])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors["--c-blanc"], colors["--c-bleu-800"])).toBeGreaterThanOrEqual(4.5)
    expect(SHELL).toMatch(/\.bottom-nav--v2 \.bottom-nav__cta \{[^}]*top: -18px; flex: none;[^}]*width: 52px; height: 52px;[^}]*border-radius: 50%; background: var\(--c-bleu\); color: var\(--c-blanc\);/)
    expect(SHELL).toMatch(/\.bottom-nav--v2 \.bottom-nav__cta \{[^}]*box-shadow: 0 0 0 4px var\(--c-encre\), var\(--sh-dur-s\);/)
    expect(SHELL).toContain('.bottom-nav--v2 .bottom-nav__cta[aria-current="page"] { box-shadow: 0 0 0 3px var(--c-encre), 0 0 0 6px var(--c-citron); }')
    expect(SHELL).toContain(".bottom-nav--v2 .bottom-nav__cta:active { background: var(--c-bleu-800); transform: scale(.94); }")
    expect(SHELL).toContain(".bottom-nav--v2 .bottom-nav__cta:focus-visible { outline: 2px solid transparent; box-shadow: var(--sh-focus); }")
    // Le soulevement ne passe pas par transform (reserve a l'echelle d'appui) et reste sous la reserve de contenu de 24 px.
    expect(SHELL).not.toMatch(/\.bottom-nav__cta \{[^}]*translate/)
    expect(18 - (72 - 52) / 2 + 4).toBeLessThan(24)
    const ancestors = ["ds", "c2", "shell", "shell--v2", "shell__main", "bottom-nav", "bottom-nav--v2"]
    const cta = computedStyle(RULES, { tag: "a", classes: ["bottom-nav__cta"], ancestors })
    expect(cta.background).toBe("var(--c-bleu)")
    expect(cta.width).toBe("52px")
    expect(computedStyle(RULES, { tag: "a", classes: ["bottom-nav__cta"], ancestors, states: ["focus-visible"] })["box-shadow"]).toBe("var(--sh-focus)")
    expect(computedStyle(RULES, { tag: "a", classes: ["bottom-nav__cta"], ancestors, states: ["hover"] }).background).toBe("var(--c-bleu-700)")
  })

  it("capsule : mouvement reduit coupe transitions et animations de la barre (et l'echelle a l'appui), libelle anime par keyframes", () => {
    const reduced = SHELL.slice(SHELL.indexOf("@media (prefers-reduced-motion: reduce)"))
    expect(reduced).toContain(".bottom-nav--v2, .bottom-nav--v2 * { transition: none !important; animation: none !important; }")
    expect(reduced).toContain(".bottom-nav--v2 .bnav-item:active, .bottom-nav--v2 .bottom-nav__cta:active { transform: none !important; }")
    expect(SHELL).toMatch(/@keyframes bnav2-label-in \{ from \{ opacity: 0; transform: translateX\(-4px\); \} to \{ opacity: 1; transform: none; \} \}/)
    expect(SHELL).toMatch(/\.bottom-nav--v2 \.bnav-label \{[^}]*animation: bnav2-label-in var\(--dur-3\) var\(--ease\);/)
  })

  it("capsule etroite (maquette validee) : marges 8 px, padding 4 px, ecart 0, inactifs de 40 px, « Portefeuille » entier a 320 px", () => {
    const narrow = SHELL.slice(SHELL.indexOf("@media (max-width: 480px)"), SHELL.indexOf("/* ---------- Mouvement reduit"))
    expect(narrow).toContain(".bottom-nav.bottom-nav--v2 { left: 8px; right: 8px; padding: 0 var(--s-1); gap: 0; }")
    expect(narrow).toContain(".bottom-nav--v2 .bnav-item, .bnav2-more { min-width: 40px; }")
    expect(narrow).toContain(".bottom-nav--v2 .bnav-item.is-active { gap: 6px; padding: 0 10px; }")
    expect(narrow).toContain(".bottom-nav--v2 .bottom-nav__cta { margin: 0; }")
    // L'exception 40 px n'existe que dans la plage etroite : la regle de base reste a 44 px (hauteur 48 partout).
    expect(SHELL).toMatch(/\.bottom-nav--v2 \.bnav-item \{[^}]*min-width: 44px; height: 48px;/)
    expect(narrow).not.toMatch(/\.bnav-item[^{]*\{[^}]*height:/)
    // Largeur laissee au libelle de l'actif : ecran - marges 2 x 8 - padding 2 x 4 - Publier 52 - 3 inactifs de 40 - (icone 24 + ecart 6 + padding 2 x 10).
    const label = (screen) => screen - 16 - 8 - 52 - 3 * 40 - (24 + 6 + 20)
    const PORTEFEUILLE = 70.45 // largeur mesuree du texte « Portefeuille » a 13 px, 800
    expect(label(320)).toBe(74)
    expect(label(320)).toBeGreaterThanOrEqual(71) // aucune ellipse a 320 px (l'ellipse reste en repli)
    expect(label(320)).toBeGreaterThanOrEqual(PORTEFEUILLE)
    expect(label(360)).toBeGreaterThanOrEqual(88)
  })

  it("detecteur de keyframes : les etapes from/to ne sont pas des selecteurs de regle", () => {
    expect(selectorsOf("@keyframes k2 { from { opacity: 0; } 40% { opacity: .5; } to { opacity: 1; } } .a2 { color: red; }")).toEqual([".a2"])
  })

  it("ecran de detail mobile : .shell--detail masque la barre du bas et reserve la hauteur de .mbar2, jamais les deux barres ensemble", () => {
    const tablet = SHELL.slice(SHELL.indexOf("@media (max-width: 1023.98px)"))
    expect(tablet).toMatch(/\.shell--v2\.shell--detail \.bnav2[^{]*\{ display: none; \}/)
    expect(tablet).toMatch(/\.shell--v2\.shell--detail \.bottom-nav--v2[^{]*\{ display: none; \}/)
    // Repli :has() : chaque regle est seule dans sa liste (un navigateur sans :has ignorerait toute la liste).
    expect(tablet).toMatch(/\n\s*\.shell--v2:has\(\.mbar2\) \.bnav2 \{ display: none; \}/)
    expect(tablet).toMatch(/\n\s*\.shell--v2:has\(\.mbar2\) \.bottom-nav--v2 \{ display: none; \}/)
    expect(tablet).toMatch(/\n\s*\.shell--v2:has\(\.mbar2\) \.shell__main \{ padding-bottom: calc\(150px \+ env\(safe-area-inset-bottom, 0px\)\); \}/)
    expect(selectorsOf(ALL).filter((sel) => sel.includes(":has(") && sel.includes(","))).toEqual([])
    expect(tablet).toMatch(/\.shell--v2\.shell--detail \.shell__main, \.shell--v2\.shell--detail \.main2 \{ padding-bottom: calc\(150px \+ env\(safe-area-inset-bottom/)
    expect(CLIENT).toMatch(/\.mbar2 \{ display: flex; \}/)
    expect(SHELL).toContain("shell--detail")
  })

  it("applique l'anneau de focus sombre aux boutons et liens poses sur fonds sombres, et le mouvement reduit a .c2", () => {
    for (const sel of [".btn--sidebar", ".btn--blanc", ".money2 a"]) expect(SHELL).toContain(`${sel}:focus-visible`)
    expect(SHELL).toMatch(/\.money2 a:focus-visible \{[^}]*var\(--sh-focus-sombre\)/)
    expect(SHELL).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.app2 \*, \.c2 \*/)
  })

  it("fournit la coquille responsive : en-tete mobile et barre du bas sous 1024, focus visible, mouvement reduit", () => {
    expect(SHELL).toMatch(/\.mtop2 \{[^}]*display: none/)
    expect(SHELL).toMatch(/\.bnav2 \{[^}]*display: none/)
    const tablet = SHELL.slice(SHELL.indexOf("@media (max-width: 1023.98px)"))
    expect(tablet).toMatch(/\.mtop2 \{ display: flex; \}/)
    expect(tablet).toMatch(/\.bnav2 \{ display: grid; \}/)
    expect(tablet).toMatch(/\.side2, \.top2 \{ display: none; \}/)
    for (const c of [".nav2", ".iconbtn2", ".item2__action", ".bnav2__item", ".shell--v2 .nav-item"]) {
      expect(SHELL).toContain(`${c}:focus-visible`)
    }
    expect(SHELL).toContain("var(--sh-focus)")
  })
})

describe("C17 profil : requetes de conteneur de la colonne principale", () => {
  const c17 = stripComments(read("client/c17.css"))
  const container = (cond) => c17.match(new RegExp(`@container profile2col \\(${cond}\\) \\{((?:[^{}]*\\{[^{}]*\\})*)\\s*\\}`))?.[1] ?? ""

  it("declare le conteneur sur la colonne, et empile le lien Modifier sous le nom en colonne etroite", () => {
    expect(c17).toMatch(/\.profile2 \.col2 \{ container: profile2col \/ inline-size; \}/)
    expect(container("max-width: 480px")).toMatch(/\.me2 \{ flex-wrap: wrap; \}/)
    expect(container("max-width: 480px")).toMatch(/\.me2__edit \{ margin-left: 0; flex: 1 1 100%; \}/)
  })

  it("passe les 4 chiffres sur 2 colonnes, valeurs a la ligne et sous-textes sans ellipse", () => {
    const narrow = container("max-width: 720px")
    expect(narrow).toMatch(/\.stats2--4 \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/)
    expect(narrow).toMatch(/\.stat2__value \{[^}]*white-space: normal; overflow-wrap: anywhere;/)
    expect(c17).toMatch(/\.stat2__sub \{ white-space: normal; overflow: visible; text-overflow: clip; \}/)
  })

  it("le nom passe a la ligne par mots (jamais anywhere) et l'avatar ne se comprime pas", () => {
    expect(c17).toMatch(/\.me2 \.me2__name \{[^}]*overflow-wrap: break-word;/)
    expect(c17).not.toMatch(/\.me2 \.me2__name \{[^}]*anywhere/)
    expect(c17).toMatch(/\.me2 \.av2 \{ flex: none; \}/)
  })

  it("la plage 1024-1150 px (colonne = ecran - 693 px, soit 331 a 457 px) tombe dans les deux requetes", () => {
    for (const screen of [1024, 1100, 1150]) {
      const col = screen - 693
      expect(col).toBeLessThanOrEqual(480)
      expect(col).toBeGreaterThanOrEqual(320)
      // Avatar 80 + ecart 20 + carte 2 x 32 : le texte garde au moins 120 px, un mot comme « Houngbedji » (~110 px a 24 px) tient.
      expect(col - 64 - 80 - 20).toBeGreaterThanOrEqual(120 - 1)
    }
  })
})

describe("cibles tactiles de 44 px sous 1024 px (liens isoles)", () => {
  const phone = (file) => {
    const css = stripComments(read(`client/${file}`))
    return css.slice(css.indexOf("@media (max-width: 1023.98px)"))
  }

  it.each([
    ["c12.css", ".c2 .inbox-empty2 .actions2 .link2"],
    ["c10.css", ".c2 .done2 .actions2 .link2"],
    ["c13.css", ".c2 .bubble__place2"],
  ])("%s : %s a une hauteur minimale de 44 px dans le bloc mobile", (file, selector) => {
    const escaped = selector.replace(/\./g, "\\.")
    expect(phone(file)).toMatch(new RegExp(`${escaped} \\{[^}]*min-height: 44px`))
  })
})

describe("indicateurs de focus des fonds clairs (>= 3:1)", () => {
  const colors = parseColorTokens(read("tokens.css"))

  // Carte d'urgence C03 selectionnee (fond blanc) : anneau --sh-focus (2 px blanc puis 3 px bleu), conserve par c03.css.
  // Champ de saisie de la conversation : bordure bleue pleine au focus (le halo 18 % n'est qu'un renfort).
  // Aucune de ces deux regles ne necessite de renfort : le bleu atteint 8,1:1 sur blanc et 7,4:1 sur givre.
  it.each([["--c-blanc"], ["--c-givre"]])("le bleu de l'indicateur de focus contraste >= 3:1 avec %s", (bg) => {
    expect(contrastRatio(colors["--c-bleu"], colors[bg])).toBeGreaterThanOrEqual(3)
  })

  it("garde l'anneau plein sur la carte d'urgence selectionnee et la bordure bleue du champ de conversation", () => {
    expect(read("tokens.css")).toMatch(/--sh-focus: 0 0 0 2px var\(--c-blanc\), 0 0 0 5px var\(--c-bleu\)/)
    expect(CLIENT).toContain(".c2 .choice.is-selected:focus-visible { box-shadow: var(--sh-focus); }")
    expect(CLIENT).toMatch(/\.c2 \.composer__field:focus-within \{[^}]*border-color: var\(--c-bleu\)/)
  })
})

// ---------- Mini-cascade statique : specificite et ordre (les garde-fous de presence ne voient pas ces conflits) ----------

/** Specificite (ids, classes + pseudo-classes, balises) d'un selecteur sans combinateur autre que l'espace. */
function specificity(selector) {
  let classes = 0
  let tags = 0
  for (const c of selector.trim().split(/\s+/)) {
    classes += (c.match(/\.[\w-]+/g) ?? []).length + (c.match(/:[\w-]+/g) ?? []).length
    if (/^[a-z]/i.test(c)) tags += 1
  }
  return [0, classes, tags]
}
const compareSpec = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

function parseCompound(c) {
  return {
    tag: c.match(/^[a-z][\w-]*/i)?.[0] ?? null,
    classes: (c.match(/\.[\w-]+/g) ?? []).map((x) => x.slice(1)),
    states: (c.match(/:[\w-]+/g) ?? []).map((x) => x.slice(1)),
  }
}

/** Regles de premier niveau (hors @media), dans l'ordre du texte : { selector, declarations, order }. */
function topLevelRules(css, startOrder = 0) {
  const flat = css.replace(AT_BLOCK, "")
  const rules = []
  let order = startOrder
  for (const m of flat.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const declarations = {}
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":")
      if (i > 0) declarations[d.slice(0, i).trim()] = d.slice(i + 1).trim()
    }
    for (const sel of m[1].split(",").map((x) => x.trim())) {
      if (/[>+~*()[]|::/.test(sel)) continue
      rules.push({ selector: sel, declarations, order: order++ })
    }
  }
  return rules
}

/** Valeurs calculees (specificite puis ordre) d'un element : balise, classes, ancetres, pseudo-classes d'etat. */
function computedStyle(rules, { tag, classes, ancestors, states = [] }) {
  const won = {}
  for (const rule of rules) {
    const parts = rule.selector.split(/\s+/).map(parseCompound)
    const subject = parts.pop()
    if (subject.tag && subject.tag !== tag) continue
    if (!subject.classes.every((c) => classes.includes(c)) || !subject.states.every((s) => states.includes(s))) continue
    if (!parts.every((p) => p.classes.every((c) => ancestors.includes(c)))) continue
    const spec = specificity(rule.selector)
    for (const [prop, value] of Object.entries(rule.declarations)) {
      const cur = won[prop]
      const cmp = cur ? compareSpec(spec, cur.spec) : 1
      if (cmp > 0 || (cmp === 0 && rule.order > cur.order)) won[prop] = { value, spec, order: rule.order }
    }
  }
  return Object.fromEntries(Object.entries(won).map(([k, v]) => [k, v.value]))
}

// Ordre de chargement reel : components, layouts, app-shell, puis client.css (base en premier).
const LOAD_ORDER = ["components.css", "layouts.css", "app-shell.css", ...[...read("client.css").matchAll(/@import "\.\/(client\/[\w-]+\.css)";/g)].map((m) => m[1])]
const RULES = LOAD_ORDER.reduce((acc, f) => acc.concat(topLevelRules(stripComments(read(f)), acc.length)), [])
const ANCESTORS = ["ds", "c2", "shell", "shell--v2", "shell__frame", "shell__main", "money2", "money2--split", "hero2__actions", "money2__foot"]

describe("cascade statique : specificite et ordre de chargement", () => {
  it("calcule la specificite", () => {
    expect(specificity(".btn--blanc")).toEqual([0, 1, 0])
    expect(specificity(".c2 .btn--secondary")).toEqual([0, 2, 0])
    expect(specificity(".money2 a")).toEqual([0, 1, 1])
    expect(specificity(".c2 a.ds-skip-link:focus-visible")).toEqual([0, 3, 1])
  })

  it("lien d'evitement : hors ecran au repos, visible avec anneau de focus au focus clavier dans .c2", () => {
    const el = { tag: "a", classes: ["ds-skip-link", "btn", "btn--secondary"], ancestors: ANCESTORS }
    const rest = computedStyle(RULES, el)
    expect(rest.transform).toBe("translateY(-200%)")
    expect(rest["box-shadow"]).toBe("none")
    const focus = computedStyle(RULES, { ...el, states: ["focus-visible"] })
    expect(focus.transform).toBe("none")
    expect(focus["box-shadow"]).toBe("var(--sh-focus)")
    expect(focus.position).toBe("fixed")
    expect(focus["z-index"]).toBe("var(--z-toast)")
  })

  it("detecte le conflit d'origine : sans les regles de la coquille, .c2 .btn--secondary annule le transform", () => {
    const without = RULES.filter((r) => !r.selector.startsWith(".c2 a.ds-skip-link") && !r.selector.startsWith(".c2 .btn--secondary:focus-visible"))
    const rest = computedStyle(without, { tag: "a", classes: ["ds-skip-link", "btn", "btn--secondary"], ancestors: ANCESTORS })
    expect(rest.transform).toBe("none")
  })

  it("recherche de .c2 : la bordure bleue de focus de .search:focus-within n'est pas annulee, et c02.css ne la double pas", () => {
    expect(specificity(".c2 .search:focus-within")).toEqual([0, 3, 0])
    const el = { tag: "div", classes: ["search"], ancestors: ANCESTORS }
    expect(computedStyle(RULES, el).border).toBe("1px solid var(--c-ligne)")
    expect(computedStyle(RULES, { ...el, states: ["focus-within"] })["border-color"]).toBe("var(--c-bleu)")
    expect(read("client/c02.css")).not.toContain(".search:focus-within")
  })

  it("recherche de la barre du haut : le focus bleu l'emporte sur la bordure givre de .shell--v2 .search2", () => {
    expect(specificity(".shell--v2 .search2:focus-within")).toEqual([0, 3, 0])
    expect(specificity(".shell--v2 .search2")).toEqual([0, 2, 0])
    const el = { tag: "div", classes: ["search2"], ancestors: ANCESTORS }
    expect(computedStyle(RULES, el)["border-color"]).toBe("var(--c-givre)")
    expect(computedStyle(RULES, { ...el, states: ["focus-within"] })["border-color"]).toBe("var(--c-bleu)")
    expect(SHELL).toMatch(/\.shell--v2 \.search2:focus-within, \.shell--v2 \.search2\.is-focus \{ border-color: var\(--c-bleu\); \}/)
    expect(SHELL.indexOf(".shell--v2 .search2:focus-within")).toBeGreaterThan(SHELL.indexOf(".shell--v2 .search2 {"))
  })

  it("mobile : cibles tactiles de 44 px et sous-textes a la ligne, uniquement sous 1024 px et dans .c2", () => {
    const m = SHELL.match(/@media \(max-width: 1023\.98px\) \{\s*\.c2 \.item2__action[\s\S]*?\n\}/)
    expect(m, "bloc mobile dedie").not.toBeNull()
    const block = m[0]
    expect(block).toMatch(/\.c2 \.item2__action, \.c2 \.hero2__link \{ display: inline-flex; align-items: center; min-height: 44px; \}/)
    expect(block).toMatch(/\.c2 \.btn--sm \{ min-height: 44px; \}/)
    expect(block).toMatch(/\.c2 \.list2__more \{ display: inline-flex; align-items: center; min-height: 44px; \}/)
    expect(block).toMatch(/\.c2 \.mtop2 > a \{ position: relative; \}/)
    expect(block).toMatch(/\.c2 \.mtop2 > a::after \{ content: ""; position: absolute; inset: -6px; \}/)
    expect(block).toMatch(/\.c2 \.stat2__sub, \.c2 \.money2 \.stat2__sub \{ white-space: normal; overflow: visible; text-overflow: clip; \}/)
    // aucune de ces regles n'existe hors media : la version bureau reste inchangee
    const outside = SHELL.replace(block, "")
    expect(outside).not.toMatch(/min-height: 44px/)
    expect(outside).not.toContain(".mtop2 > a::after")
    for (const line of block.split("\n").filter((l) => l.includes("{") && !l.startsWith("@") && l.trim().startsWith("."))) {
      expect(line.trim().startsWith(".c2 "), line).toBe(true)
    }
  })

  it("unites de montant : jamais sous 13 px (.amount--s small, .fund2__amt small), dans .c2", () => {
    const amountS = { tag: "small", classes: [], ancestors: [...ANCESTORS, "amount", "amount--s"] }
    expect(computedStyle(RULES, amountS)["font-size"]).toBe("max(var(--t-micro), .76em)")
    const amountM = { tag: "small", classes: [], ancestors: [...ANCESTORS, "amount"] }
    expect(computedStyle(RULES, amountM)["font-size"]).toBe("max(var(--t-micro), .42em)")
    const fund = { tag: "small", classes: [], ancestors: [...ANCESTORS, "fund2__amt"] }
    expect(computedStyle(RULES, fund)["font-size"]).toBe("max(var(--t-micro), .8em)")
    const c14 = stripComments(read("client/c14.css"))
    expect(relativeSizeOffenders(c14)).toEqual([])
    expect(relativeSizeOffenders(stripComments(read("client/c08.css")))).toEqual([])
  })

  it("C04 : pastille « a examiner » sur une ligne, titre et tri a la ligne, badge sous le nom, sous .c2", () => {
    const c04 = stripComments(read("client/c04.css"))
    expect(c04).toContain(".c2 .cand2__list .flag2 { white-space: nowrap; }")
    expect(c04).toMatch(/\.c2 \.cand2__list \.list2__head \{ flex-wrap: wrap;/)
    expect(c04).toMatch(/\.c2 \.cand2 \.cand2__top \{ flex-wrap: wrap;/)
  })

  it("cibles tactiles de 44 px sous 1024 px (I7), scopees .c2, dans la requete (max-width: 1023.98px)", () => {
    const inTablet = (file, rule) => {
      const css = stripComments(read(file))
      const tablet = css.slice(css.indexOf("@media (max-width: 1023.98px)"))
      expect(tablet, `${file} : ${rule}`).toContain(rule)
      expect(css.slice(0, css.indexOf("@media (max-width: 1023.98px)")), `${file} hors media`).not.toContain(rule)
    }
    inTablet("client/base.css", ".c2 .modal__head .btn-icon, .c2 .drawer__head .btn-icon { width: 44px; height: 44px; }")
    inTablet("client/c05.css", ".c2 .drawer .link2 { min-height: 44px; }")
    inTablet("client/c08.css", ".c2 .fup2 .status2 .link2 { display: inline-flex; min-height: 44px; }")
    inTablet("client/c08.css", ".c2 .head2__date .meta2 > a::after { content: \"\"; position: absolute; inset: -12px -6px; }")
    inTablet("client/c09.css", ".c2 .modal__body .check { min-height: 44px; align-items: flex-start; }")
    inTablet("client/c09.css", ".c2 .modal__body .note2 .link2 { display: inline-flex; min-height: 44px; }")
    inTablet("client/c15.css", ".c2 .banner__actions .link2 { min-height: 44px; }")
    inTablet("client/c16.css", ".c2 .modal__body .chip { min-height: 44px; }")
  })

  it("avatar de l'en-tete mobile : .c2 .av2 { overflow: hidden } ne rogne plus le pseudo-element de la zone de 44 px", () => {
    expect(SHELL).toContain(".c2 .av2 { overflow: hidden; }")
    const block = SHELL.slice(SHELL.indexOf(".c2 .mtop2 > a::after"))
    expect(block).toContain(".c2 .mtop2 > a.av2 { overflow: visible; }")
    expect(specificity(".c2 .mtop2 > a.av2")[1]).toBeGreaterThan(specificity(".c2 .av2")[1])
    // la structure reelle : les deux liens directs de .mtop2, dont l'avatar a la classe av2
    const mobileTop = readFileSync(path.join(dir, "..", "..", "components", "app-shell", "mobile-top.jsx"), "utf8")
    expect(mobileTop).toContain('<header className="mtop2">')
    expect(mobileTop).toMatch(/<Link className="av2 av2--sm" href=\{nav\.profileHref\}/)
  })

  it("bouton « Retirer » inactif de la carte argent : l'opacite .45 de .c2 .btn.is-disabled ne s'applique pas", () => {
    const el = { tag: "button", classes: ["btn", "btn--ghost-blanc", "btn--sm", "is-disabled"], ancestors: ANCESTORS }
    expect(computedStyle(RULES, el).opacity).toBe("1")
    // hors carte argent (.money2), le bouton inactif de .c2 garde son opacite reduite
    const elsewhere = { tag: "button", classes: ["btn", "is-disabled"], ancestors: ["c2", "shell--v2"] }
    expect(computedStyle(RULES, elsewhere).opacity).toBe(".45")
  })

  it("historique et carte argent : requetes de conteneur sur la carte (B2), jamais un seuil d'ecran", () => {
    const c14 = stripComments(read("client/c14.css"))
    expect(c14).toMatch(/\.txs2 \{ container: txs2 \/ inline-size; \}/)
    expect(c14).toMatch(/\.money2--split \{ container: money2 \/ inline-size; \}/)
    const tx = c14.match(/@container txs2 \(max-width: 600px\) \{([\s\S]*?)\n\}/)?.[1] ?? ""
    expect(tx).toMatch(/\.tx2 \{ grid-template-columns: minmax\(0, 1fr\) auto; grid-template-areas: "main amt" "date badge";/)
    expect(tx).toMatch(/\.tx2__title, \.tx2__sub \{ white-space: normal;/)
    expect(tx).toContain(".tx2__badge { grid-area: badge;")
    const money = c14.match(/@container money2 \(max-width: 480px\) \{([\s\S]*?)\n\}/)?.[1] ?? ""
    expect(money).toMatch(/\.money2--split \.stat2__value \{ font-size: max\(var\(--t-micro\), clamp\(13px, 7\.6cqi, var\(--t-amount-s\)\)\);[^}]*white-space: normal;/)
    // taille fluide conservee dans le conteneur (jamais une taille fixe qui ecrase celle d'app-shell.css), plancher 13 px
    expect(money).not.toMatch(/\.stat2__value \{ font-size: var\(--t-amount-s\)/)
    // 10 chiffres a 320 px : la valeur peut passer a la ligne et l'unite descend sous le chiffre
    expect(money).toMatch(/\.money2--split \.stat2__value \{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/)
    expect(money).toContain(".money2--split .stat2__value small { display: block; margin-left: 0; }")
    // sous-textes de la carte argent : retour a la ligne, pas d'ellipse, avant les requetes de conteneur
    expect(c14).toMatch(/\.money2--split \.stat2__sub \{ white-space: normal; overflow: visible; text-overflow: clip; \}/)
    expect(c14.indexOf(".money2--split .stat2__sub {")).toBeLessThan(c14.indexOf("@container money2"))
    // la grille complete a 4 colonnes reste celle des cartes larges
    expect(c14).toMatch(/\.tx2 \{ grid-template-columns: 60px minmax\(0, 1fr\) 132px 120px; \}/)
  })

  it("avatar de l'en-tete mobile : zone tactile de 44 x 44 (inset -7px, bordure de 1 px comprise)", () => {
    const tablet = SHELL.match(/@media \(max-width: 1023\.98px\) \{([\s\S]*?)\n\}/g)?.join("\n") ?? ""
    expect(tablet).toContain('.c2 .mtop2 > a::after { content: ""; position: absolute; inset: -6px; }')
    expect(tablet).toContain(".c2 .mtop2 > a.av2::after { inset: -7px; }")
    expect(tablet).toContain(".c2 .mtop2 > a.av2 { overflow: visible; }")
  })

  it("boutons secondaire et accent de .c2 : l'anneau de focus n'est pas annule par box-shadow: none", () => {
    for (const tone of ["btn--secondary", "btn--accent"]) {
      const focus = computedStyle(RULES, { tag: "button", classes: ["btn", tone], ancestors: ANCESTORS, states: ["focus-visible"] })
      expect(focus["box-shadow"], tone).toBe("var(--sh-focus)")
    }
  })

  it("carte argent : bouton blanc en encre sans soulignement, bouton contour en blanc sans soulignement", () => {
    for (const small of [[], ["btn--sm"]]) {
      for (const states of [[], ["visited"]]) {
        const blanc = computedStyle(RULES, { tag: "a", classes: ["btn", "btn--blanc", ...small], ancestors: ANCESTORS, states })
        expect(blanc.color).toBe("var(--c-encre)")
        expect(blanc.background).toBe("var(--c-blanc)")
        expect(blanc["text-decoration"]).toBe("none")
        const ghost = computedStyle(RULES, { tag: "a", classes: ["btn", "btn--ghost-blanc", ...small], ancestors: ANCESTORS, states })
        expect(ghost.color).toBe("var(--c-blanc)")
        expect(ghost.background).toBe("transparent")
        expect(ghost["text-decoration"]).toBe("none")
      }
    }
  })

  it("carte argent : le lien simple reste blanc souligne, jamais bleu sur bleu", () => {
    const link = computedStyle(RULES, { tag: "a", classes: ["hero2__link"], ancestors: ANCESTORS })
    expect(link.color).toBe("var(--c-blanc)")
    expect(link["text-decoration"]).toBe("underline")
    const sub = computedStyle(RULES, { tag: "a", classes: [], ancestors: [...ANCESTORS, "stat2__sub"] })
    expect(sub.color).toBe("var(--c-blanc)")
  })

  it("detecte le conflit d'origine : sans la correction, `.money2 a` rend le bouton blanc sur blanc", () => {
    const without = RULES.filter((r) => !/^\.money2 a\.btn/.test(r.selector))
    const blanc = computedStyle(without, { tag: "a", classes: ["btn", "btn--blanc"], ancestors: ANCESTORS })
    expect(blanc.color).toBe("var(--c-blanc)")
  })

  // Collision de racines (RD-CLIENT-01 vague 4) : C10 redefinissait `.review2` (le <dl> de C03). Une meme classe
  // nue (`.nom { ... }`, premier niveau) ne doit jamais fixer la meme propriete dans deux feuilles ; deux feuilles
  // qui la completent avec des proprietes differentes (ex. `.inbox2` C12 et C13) ne sont pas un conflit.
  it("aucune classe racine ne fixe la meme propriete dans deux feuilles differentes (app-shell, c0x, c1x)", () => {
    const owners = {}
    for (const f of LOAD_ORDER) {
      for (const rule of topLevelRules(stripComments(read(f)))) {
        if (!/^\.[\w-]+$/.test(rule.selector)) continue
        for (const prop of Object.keys(rule.declarations)) {
          const key = `${rule.selector} { ${prop} }`
          ;(owners[key] ??= new Set()).add(f)
        }
      }
    }
    const collisions = Object.entries(owners).filter(([, files]) => files.size > 1).map(([k, files]) => `${k}: ${[...files].join(", ")}`)
    expect(collisions).toEqual([])
  })

  it("le recapitulatif de publication `.review2` (dl C03) reste une grille, la page C10 utilise `.rate-page2`", () => {
    const dl = computedStyle(RULES, { tag: "dl", classes: ["review2"], ancestors: [] })
    expect(dl.display).toBe("grid")
    // Une colonne par defaut (carte etroite) ; 160px + 1fr via la requete de conteneur wizard2card (voir plus bas).
    expect(dl["grid-template-columns"]).toBe("minmax(0, 1fr)")
    const c10 = stripComments(read("client/c10.css"))
    expect(c10).not.toMatch(/\.review2(?![\w-])/)
    expect(c10).toMatch(/\.rate-page2 \{[^}]*flex-direction: column/)
  })
})

describe("regles des primitives interactives (app-ui)", () => {
  it("fournit toasts fixes, tiroir plein ecran, bouton d'etoile et focus clavier tab/chip limite a .c2 et .shell--v2", () => {
    expect(SHELL).toMatch(/\.ds-toasts-fixed \{[^}]*position: fixed/)
    expect(SHELL).toMatch(/\.toasts--mobile\.ds-toasts-fixed \{[^}]*bottom: calc\(86px \+ env\(safe-area-inset-bottom/)
    const tablet = SHELL.slice(SHELL.indexOf("@media (max-width: 1023.98px)"))
    expect(tablet).toMatch(/\.ds-drawer--full \{[^}]*width: 100%[^}]*box-shadow: none/)
    expect(SHELL).toMatch(/\.ds-stars__btn \{[^}]*cursor: pointer/)
    expect(SHELL).toContain(".ds-stars__btn:focus-visible")
    for (const c of [".tab", ".chip"]) {
      expect(SHELL).toContain(`.c2 ${c}:focus-visible, .shell--v2 ${c}:focus-visible { outline: none; box-shadow: var(--sh-focus)`)
    }
  })
})

describe("client.css et globals.css", () => {
  const clientCss = read("client.css")
  const globals = readFileSync(path.join(dir, "..", "globals.css"), "utf8")

  it("importe toutes les feuilles de client/ une fois, base en premier", () => {
    const imports = [...clientCss.matchAll(/@import "\.\/client\/([\w-]+\.css)";/g)].map((m) => m[1])
    expect(imports[0]).toBe("base.css")
    expect([...imports].sort()).toEqual(CLIENT_FILES)
    expect(new Set(imports).size).toBe(imports.length)
    for (const n of ["c01", "c02", "c07", "c11", "c15"]) expect(imports).toContain(`${n}.css`)
  })

  it("est branche dans globals.css en couche components, apres layouts.css, app-shell avant client", () => {
    const order = ["tokens.css", "components.css", "layouts.css", "app-shell.css", "client.css"].map((f) => globals.indexOf(`./design/${f}`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(globals).toContain('@import "./design/app-shell.css" layer(components);')
    expect(globals).toContain('@import "./design/client.css" layer(components);')
  })
})

// Recapitulatif de publication C03 (RD-CLIENT-01 vague 4 bis) : le garde-fou ne voit pas le style calcule, ces tests
// verifient la structure des regles et calculent la largeur disponible d'apres la formule mesuree : colonne
// principale = largeur d'ecran - 693 px (sidebar + colonne laterale + marges), carte = colonne, contenu = carte - 64 px.
describe("C03 : recapitulatif et pied de formulaire entre 1024 et 1150 px", () => {
  const c03 = stripComments(read("client/c03.css"))
  const CARD_PADDING = 64
  const TWO_COLUMNS_FROM = 400
  const LABEL_COLUMN = 160
  const GAP = 16
  const contentWidth = (screen) => screen - 693 - CARD_PADDING
  const container = c03.match(/@container wizard2card \(min-width: (\d+)px\) \{([\s\S]*?)\n\}/)

  it("la carte du formulaire est un conteneur nomme et le seuil de deux colonnes est celui du calcul", () => {
    expect(c03).toMatch(/\.wizard2 \.form2 \{ container: wizard2card \/ inline-size; \}/)
    expect(Number(container[1])).toBe(TWO_COLUMNS_FROM)
    expect(container[2]).toMatch(/\.review2 \{ grid-template-columns: 160px minmax\(0, 1fr\);/)
  })

  it("une colonne par defaut, sans media query de largeur d'ecran supplementaire pour le recapitulatif", () => {
    const base = computedStyle(RULES, { tag: "dl", classes: ["review2"], ancestors: [] })
    expect(base["grid-template-columns"]).toBe("minmax(0, 1fr)")
    expect(c03).not.toMatch(/@media[^{]*\{[^@]*\.review2/)
  })

  it.each([1024, 1060, 1100, 1149])("a %i px le contenu de la carte reste sous le seuil : libelles empiles, valeurs pleine largeur", (screen) => {
    const w = contentWidth(screen)
    expect(w).toBeGreaterThanOrEqual(267)
    expect(w).toBeLessThan(TWO_COLUMNS_FROM)
    // Empile : la valeur occupe tout le contenu (au moins 267 px) ; l'ancienne grille 160 px + 1fr ne lui laissait
    // que 91 a 160 px, sous les 224 px obtenus au seuil de deux colonnes.
    expect(w - LABEL_COLUMN - GAP).toBeLessThan(TWO_COLUMNS_FROM - LABEL_COLUMN - GAP)
  })

  it("au seuil la colonne des valeurs mesure au moins 224 px", () => {
    expect(TWO_COLUMNS_FROM - LABEL_COLUMN - GAP).toBeGreaterThanOrEqual(224)
    expect(contentWidth(1280)).toBeGreaterThanOrEqual(TWO_COLUMNS_FROM)
  })

  it("le pied de formulaire passe a la ligne et le bouton ne depasse jamais de la carte", () => {
    expect(c03).toMatch(/\.wizard2 \.form2__foot--split \{ flex-wrap: wrap; \}/)
    expect(c03).toMatch(/\.wizard2 \.form2__foot--split > \.btn \{ min-width: 0; max-width: 100%; \}/)
    expect(c03).toMatch(/\.wizard2 \.btn--dark \{[^}]*height: auto; min-height: var\(--h-btn\);[^}]*white-space: normal;/)
  })
})

// Barre mobile de l'assistant (.mbar2) a 320 px avec un budget de 9 chiffres : « Retour » compact, le bouton principal
// prend le reste. Largeurs d'apres les mesures : bouton plein 139 px (22 px de padding), fleche decorative du bouton principal masquee (20 px + gap 8 px gagnes).
describe("C03 : barre mobile de publication a 320 px", () => {
  const c03 = stripComments(read("client/c03.css"))
  const narrow = c03.match(/@media \(max-width: 480px\) \{([\s\S]*?)\n\}/)?.[1] ?? ""
  const PADDING = 14
  const BAR_PADDING = 32
  const ROW_GAP = 12
  const BORDER = 3
  const RETOUR = 139 - 2 * (22 - PADDING)
  const primaryContent = (screen) => screen - BAR_PADDING - ROW_GAP - RETOUR - BORDER - 2 * PADDING

  it("Retour est compact et le bouton principal prend le reste sans deborder, dans le media 480 px existant", () => {
    expect(narrow).toMatch(/\.wizard2 \.mbar2__row \.btn--soft \{ flex: none; padding-left: 14px; padding-right: 14px; \}/)
    expect(narrow).toMatch(/\.wizard2 \.mbar2__row \.btn--dark \{ flex: 1 1 0; min-width: 0; [^}]*overflow-wrap: anywhere; \}/)
    expect(narrow).toMatch(/\.wizard2 \.mbar2__row \.btn--dark \.ic \{ display: none; \}/)
    expect(narrow).not.toMatch(/(?:background|color|box-shadow|transform)\s*:/)
    expect(c03.match(/@media/g)).toHaveLength(2)
  })

  it("le bouton garde une hauteur d'au moins 44 px", () => {
    expect(c03).toMatch(/\.wizard2 \.btn--dark \{[^}]*min-height: var\(--h-btn\);/)
    expect(48).toBeGreaterThanOrEqual(44)
  })

  it("a 320 px le montant de 9 chiffres (11 caracteres insecables, ~9.3 px chacun) tient sur une ligne", () => {
    expect(primaryContent(320)).toBeGreaterThanOrEqual(104)
    expect(11 * 9.3).toBeLessThanOrEqual(primaryContent(320))
  })
})
