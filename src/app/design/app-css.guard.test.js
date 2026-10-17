import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { parseColorTokens, contrastRatio } from "@/lib/design/contrast"

// Garde-fou des feuilles v2.1 (RD-CLIENT-01 ST-01) : coquille connectee
// (app-shell.css) et espace client (client.css + client/*.css).
// RD-STUDENT-01 ST-01 : espace etudiant (student.css + student/*.css), en fin de fichier.

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
        // .e2 est la racine de l'espace etudiant (RD-STUDENT-01) : meme portee que .c2. Le test « aucune page sans marqueur
        // n'utilise une classe attenuee » garantit que ces regles ne changent le rendu d'aucune page non refondue qui reviendrait.
        if (part.startsWith(".c2 ") || part === ".c2" || part.startsWith(".e2 ")) continue
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
// Meme cascade, avec les feuilles de l'espace etudiant (student.css charge apres client.css).
const RULES_E2 = [...LOAD_ORDER, ...[...read("student.css").matchAll(/@import "\.\/(student\/[\w-]+\.css)";/g)].map((m) => m[1])].reduce((acc, f) => acc.concat(topLevelRules(stripComments(read(f)), acc.length)), [])

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

// =====================================================================================================
// Espace etudiant (RD-STUDENT-01 ST-01) : student.css + student/*.css, port de v2-etudiant.css.
// Memes controles que pour client/*.css (couleurs, variables, seuils, portee, ordre mobile, 13 px), plus la
// presence de chaque classe de la source, la barre d'action fixe et le respect de la capsule RD-NAV-02.
// =====================================================================================================

const STUDENT_FILES = readdirSync(path.join(dir, "student")).filter((f) => f.endsWith(".css")).sort()
const STUDENT_FILE_CSS = STUDENT_FILES.map((f) => stripComments(read(`student/${f}`)))
const STUDENT = STUDENT_FILE_CSS.join("\n")
const STUDENT_BASE = stripComments(read("student/base.css"))
const STUDENT_IMPORTS = [...read("student.css").matchAll(/@import "\.\/(student\/[\w-]+\.css)";/g)].map((m) => m[1])

// Classes des selecteurs de v2-etudiant.css (la planche), au renommage ds- pres, moins REMOVED_E2.
const STUDENT_SOURCE_CLASSES = `
amount--plus av2 avatar badge btn btn--dark btn--secondary bubble bubble--location bubble--me bubble--media bubble--them
bubble__img bubble__map bubble__meta bubble__play card chat__day check chip choice choice__mark composer__field composer__send
control count detail-card drawer e-achat__band e-shot--error e-shot--ok e-success__mark e-thumb__img e-thumb__img--ticket
e2-02-bar e2-02-bar__left e2-02-cols e2-02-count e2-02-filters e2-02-group e2-02-gtitle e2-02-mcount e2-02-msearch
e2-02-sfoot e2-02-sort e2-02-tag e2-02-tags e2-03-actions e2-03-aside e2-03-badges e2-03-caption e2-03-client e2-03-gain
e2-03-list e2-03-mbody e2-03-meta e2-03-modal e2-03-msg e2-03-mtype e2-03-sfoot e2-03-sub e2-03-ta e2-03-ta--s e2-03-top
e2-04-acts e2-04-gain e2-04-hl e2-04-list e2-04-macts e2-04-row e2-04-status e2-04-toast e2-05-actions e2-05-aside
e2-05-caption e2-05-client e2-05-fieldset e2-05-foot e2-05-meta e2-05-min e2-05-modal e2-05-pad e2-05-pad-l e2-05-pad12
e2-05-progress e2-05-progress__bar e2-05-progress__row e2-05-quote e2-05-req e2-05-req__amount e2-05-ta e2-05-ta--s
e2-05-toasts e2-05-top e2-06-convo e2-06-convo__mission e2-06-convo__name e2-06-convo__preview e2-06-convo__side e2-06-count
e2-06-inbox e2-06-inbox--tall e2-06-list e2-06-list__head e2-06-list__items e2-06-list__title e2-06-pane e2-06-skel
e2-07-achat e2-07-chat e2-07-composer e2-07-fail e2-07-form e2-07-head e2-07-ic e2-07-map e2-07-mhead e2-07-pane e2-07-shot
e2-07-status e2-07-status__text e2-08-axis e2-08-bars e2-08-pending e2-09-sentence e2-10-day e2-10-days e2-10-dist
e2-10-dist__row e2-10-id e2-10-id__actions e2-10-id__main e2-10-id__meta e2-10-id__top e2-10-links e2-10-review e2-10-score
e2-10-seal e2-11-carte e2-11-day e2-11-days e2-11-photo e2-11-photo__txt e2-11-save e2-11-save__info e2-11-sub e2-12-actions
e2-12-file e2-12-status e2-12-tips e2-12-tips__title e2-12-upload e2-12-why e2-13-actions e2-13-form e2-13-quote e2-13-rate
e2-13-stars e2-13-stars--s e2-amount e2-amount--l e2-amount--m e2-amount--s e2-back e2-cols e2-cols--l e2-empty
e2-empty__actions e2-empty__ic e2-empty__text e2-empty__title e2-form e2-form--1 e2-grid2 e2-grid3 e2-kv e2-kv__row
e2-kv__row--total e2-lead e2-link e2-link--quiet e2-mbar e2-mbar--stack e2-mbar__info e2-mcard e2-mcard__foot e2-mcard__gain
e2-mcard__meta e2-mcard__title e2-mcard__top e2-mcard__type e2-mtop e2-mtop__spacer e2-mtop__title e2-muted e2-note
e2-note--blanc e2-note__actions e2-note__body e2-note__text e2-note__title e2-op e2-op__amount e2-op__date e2-pagehead
e2-pill e2-pills e2-pills--scroll e2-sec e2-sec__body e2-sec__head e2-sec__title e2-span e2-stack e2-step e2-step--done
e2-step--now e2-step__dot e2-step__sub e2-step__title e2-tab e2-tabs e2-text e2-track e2-who e2-who__name e2-who__sub
field__count file--error file--ok file__meta file__thumb head2__title hero2__actions hero2__text hero2__title ic iconbtn2
input is-active is-checked is-current is-disabled is-done is-focus is-hover is-now is-off is-on is-recording is-selected
is-sending is-unread item2__ic item2__sub item2__title list2__filters list2__tools mission modal modal__foot modal__head
modal__icon money2 msg-system page-btn progress radio recap search2 segmented select sheet stars step step__dot step__line
tab tcard toast toast--succes toast__action toast__icon typing ds-table ds-table-wrap
`.trim().split(/\s+/)

const WHY_E2_M = "variante --m des planches (DOM mobile separe), remplacee par les media queries sur les classes de base"
const REMOVED_E2 = {
  v2e: "portee de la planche (body.v2e), remplacee par .e2 (racine posee par le layout etudiant)",
  mpage2: "gabarit mobile des planches, remplace par les media queries (la page reelle est .page2 de la coquille)",
  "mpage2--bar": "reserve du bas de page, remplacee par .shell--v2:has(.e2-mbar) .shell__main dans app-shell.css",
  "mpage2--nonav": "reserve du bas de page, remplacee par .shell--v2:has(.e2-mtop) .shell__main dans app-shell.css",
  "list2--m": WHY_E2_M, "e2-06-list--m": WHY_E2_M, "e2-sec--m": WHY_E2_M, "e2-note--m": WHY_E2_M, "e2-empty--m": WHY_E2_M,
  "e2-mcard--m": WHY_E2_M, "e2-05-foot--m": WHY_E2_M, "e2-10-id--m": WHY_E2_M, "e2-11-save--m": WHY_E2_M,
  "e2-12-upload--m": WHY_E2_M, "e2-13-stars--m": WHY_E2_M,
  "e2-11-save--stack": "empilement du message d'enregistrement, remplace par la media query 480 px",
  "bottom-nav--v2": "barre du bas : capsule RD-NAV-02 (app-shell.css), jamais surchargee par la portee etudiant",
  "bnav-item": "barre du bas : capsule RD-NAV-02 (app-shell.css), jamais surchargee par la portee etudiant",
  table: "renomme ds-table (anti-collision Tailwind)", "table-wrap": "renomme ds-table-wrap (anti-collision Tailwind)",
}
const STUDENT_CLASSES = STUDENT_SOURCE_CLASSES.filter((c) => !(c in REMOVED_E2))
// Classes nouvelles hors prefixe e2- : propres a la planche etudiant, jamais utilisees par le code ancien.
const E2_OWN = new Set(["list2__tools", "list2__filters"])
const isE2Own = (c) => /^e2-/.test(c) || E2_OWN.has(c)

describe("feuilles student.css et student/*.css", () => {
  it("student.css importe chaque feuille de student/ une fois, base en premier, e01 a e13 dans l'ordre", () => {
    expect(STUDENT_IMPORTS[0]).toBe("student/base.css")
    expect([...STUDENT_IMPORTS.map((f) => f.replace("student/", ""))].sort()).toEqual(STUDENT_FILES)
    expect(new Set(STUDENT_IMPORTS).size).toBe(STUDENT_IMPORTS.length)
    expect(STUDENT_FILES).toEqual(["base.css", ...Array.from({ length: 13 }, (_, i) => `e${String(i + 1).padStart(2, "0")}.css`)])
    expect(STUDENT_IMPORTS.slice(1)).toEqual(STUDENT_FILES.filter((f) => f !== "base.css").map((f) => `student/${f}`))
  })

  it("est branche dans globals.css en couche components, apres client.css", () => {
    const globals = readFileSync(path.join(dir, "..", "globals.css"), "utf8")
    expect(globals).toContain('@import "./design/student.css" layer(components);')
    const order = ["tokens.css", "components.css", "layouts.css", "app-shell.css", "client.css", "student.css"].map((f) => globals.indexOf(`./design/${f}`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("chaque feuille porte le marqueur @ds-screen RD-STUDENT-01 en tete", () => {
    for (const f of STUDENT_FILES) expect(read(`student/${f}`).startsWith("/* @ds-screen RD-STUDENT-01 */"), f).toBe(true)
  })

  it("contient chaque classe de v2-etudiant.css (renommages ds- pres), les retraits etant documentes dans REMOVED_E2", () => {
    expect(STUDENT_CLASSES.filter((c) => !hasClass(STUDENT, c))).toEqual([])
    expect(Object.keys(REMOVED_E2).filter((c) => hasClass(STUDENT, c))).toEqual([])
    for (const reason of Object.values(REMOVED_E2)) expect(reason.length).toBeGreaterThan(10)
  })

  it("applique le renommage ds- (table) et la portee .e2 a la place de body.v2e", () => {
    expect(STUDENT).toContain(".e2 .ds-table-wrap")
    expect(STUDENT).toContain(".e2 .ds-table td")
    expect(STUDENT).not.toMatch(/\.table(?![\w-])/)
    expect(STUDENT).not.toMatch(/v2e/)
    expect(STUDENT).toMatch(/\.e2 \.card, \.e2 \.mission, \.e2 \.detail-card \{/)
  })

  it("ne contient aucune couleur en dur (hex, rgb, rgba, hsl) ni de nom de couleur CSS nu", () => {
    expect(STUDENT).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(STUDENT).not.toMatch(/\b(?:rgba?|hsla?)\(/)
    expect(STUDENT).not.toMatch(/:\s*(?:white|black|red|green|blue)\s*[;}]/)
  })

  it("n'utilise que des variables definies dans les feuilles du systeme", () => {
    const defined = new Set()
    for (const f of [...DESIGN_CSS, "student.css", ...STUDENT_FILES.map((x) => `student/${x}`)]) for (const m of read(f).matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1])
    const used = new Set([...STUDENT.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))
    expect([...used].filter((v) => !defined.has(v))).toEqual([])
  })

  it("ne reutilise aucun nom d'utilitaire Tailwind comme classe propre", () => {
    const own = [...classNamesOf(STUDENT)].filter(isE2Own)
    expect(own.length).toBeGreaterThan(100)
    expect(own.filter((n) => TAILWIND_BARE.has(n))).toEqual([])
    expect(own.filter((n) => /^-?(?:m|p|w|h|gap|space|text|bg|border|rounded|col|row)[trblxy]?-\d/.test(n))).toEqual([])
    // Aucune classe propre ne collisionne avec une feuille deja chargee (systeme, coquille, client).
    const before = [read("components.css"), read("layouts.css"), read("app-shell.css"), ...CLIENT_FILES.map((f) => read(`client/${f}`))].join("\n")
    expect(own.filter((n) => hasClass(before, n) && !n.startsWith("e2-"))).toEqual([])
    // app-shell.css cite .e2-mtop et .e2-mbar a dessein (regles :has de la coquille) : exclu de cette comparaison.
    const beforeE2 = [read("components.css"), read("layouts.css"), ...CLIENT_FILES.map((f) => read(`client/${f}`))].join("\n")
    expect(own.filter((n) => n.startsWith("e2-") && new RegExp(`\\.${n}(?![\\w-])`).test(beforeE2))).toEqual([])
  })

  it("garde chaque regle sous .e2 ou sur une classe propre (aucun changement de rendu des pages existantes)", () => {
    const offenders = []
    for (const sel of selectorsOf(STUDENT)) {
      for (const part of sel.split(",").map((p) => p.trim())) {
        if (part === ".e2" || part.startsWith(".e2 ") || part.startsWith(".e2:")) continue
        const names = [...part.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1])
        if (!names.some(isE2Own)) offenders.push(part)
      }
    }
    expect(offenders).toEqual([])
  })

  it("n'utilise que les seuils de media query 1023.98, 767.98 et 480 (plus le mouvement reduit)", () => {
    const conditions = [...STUDENT.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim())
    const allowed = ["(max-width: 1023.98px)", "(max-width: 767.98px)", "(max-width: 480px)", "(prefers-reduced-motion: reduce)"]
    expect(conditions.filter((c) => !allowed.includes(c))).toEqual([])
    for (const a of allowed) expect(conditions).toContain(a)
    expect(STUDENT).not.toMatch(/@media[^{]*\bmin-width/)
  })

  it("n'utilise qu'une requete de conteneur : la liste de candidatures E04 (e2list, 900 px), sans seuil d'ecran", () => {
    const conditions = [...STUDENT.matchAll(/@container\s*([^{]+)\{/g)].map((m) => m[1].trim())
    expect(conditions).toEqual(["e2list (max-width: 900px)"])
    expect(stripComments(read("student/e04.css"))).toMatch(/\.e2-04-list \{[^}]*container: e2list \/ inline-size;/)
  })

  it("range les regles mobiles apres les regles de base de leur propre fichier", () => {
    for (const css of STUDENT_FILE_CSS) {
      const firstMedia = css.search(/@(?:media|container)/)
      if (firstMedia === -1) continue
      const outside = css.slice(firstMedia).replace(AT_BLOCK, "")
      expect(outside.trim()).toBe("")
    }
  })

  it("n'utilise aucune font-size en px inferieure a 13 et protege toute taille relative par max(var(--t-micro), ...)", () => {
    const sizes = [...STUDENT.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
    expect(sizes.length).toBeGreaterThan(0)
    expect(sizes.filter((px) => px < 13)).toEqual([])
    expect(relativeSizeOffenders(STUDENT)).toEqual([])
    expect(STUDENT_BASE).toContain(".e2-amount small { font-size: max(var(--t-micro), .62em);")
  })

  it("les compteurs d'onglets et de pastilles sont en ardoise (>= 4,5:1 sur blanc), jamais en acier (3,96:1)", () => {
    const colors = parseColorTokens(read("tokens.css"))
    expect(contrastRatio(colors["--c-ardoise"], colors["--c-blanc"])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors["--c-acier"], colors["--c-blanc"])).toBeLessThan(4.5)
    expect(STUDENT_BASE).toMatch(/\.e2-tab b \{[^}]*color: var\(--c-ardoise\)/)
    expect(STUDENT_BASE).toMatch(/\.e2-pill b \{[^}]*color: var\(--c-ardoise\)/)
  })

  it("aucune classe racine ne fixe la meme propriete dans deux feuilles etudiant", () => {
    const owners = {}
    for (const f of STUDENT_IMPORTS) {
      for (const rule of topLevelRules(stripComments(read(f)))) {
        if (!/^\.[\w-]+$/.test(rule.selector)) continue
        for (const prop of Object.keys(rule.declarations)) (owners[`${rule.selector} { ${prop} }`] ??= new Set()).add(f)
      }
    }
    expect(Object.entries(owners).filter(([, files]) => files.size > 1).map(([k]) => k)).toEqual([])
  })

  // Exception explicite et limitee : E01 n'a aucune regle propre, sauf le bouton pleine largeur
  // de la carte « A faire maintenant » sur mobile (planche : classe btn--block). Rien d'autre.
  const E01_ALLOWED = "@media (max-width: 1023.98px) {\n  .e2 .dash2 .card2 .hero2__actions > .btn { width: 100%; }\n}"
  const E01_RULE = ".e2 .dash2 .card2 .hero2__actions > .btn"

  it("E01 n'a aucune regle propre hors l'exception unique du bouton pleine largeur mobile", () => {
    expect(read("student/e01.css").replace(/\/\*[\s\S]*?\*\//g, "").trim()).toBe(E01_ALLOWED)
  })

  it("E01 : la regle autorisee est dans le media 1023.98 (aussi large que la capsule mobile) et ne pose que width: 100%, sans ecraser couleur, ombre ni transform", () => {
    const css = stripComments(read("student/e01.css"))
    expect(css.match(/\{/g)).toHaveLength(2)
    expect(css).toContain(`@media (max-width: 1023.98px) {\n  ${E01_RULE} { width: 100%; }`)
    const body = css.slice(css.indexOf(E01_RULE) + E01_RULE.length).match(/\{([^}]*)\}/)[1]
    expect(body.split(";").map((d) => d.trim()).filter(Boolean)).toEqual(["width: 100%"])
    expect(body).not.toMatch(/color|background|shadow|transform|border/)
  })

  it("E01 : la regle cible un bouton present dans la vue du tableau de bord", () => {
    const view = readFileSync(path.join(dir, "..", "..", "components/student-space/dashboard/student-dashboard-view.jsx"), "utf8")
    for (const c of ["dash2", "card2", "hero2__actions", "btn"]) expect(view).toMatch(new RegExp(`className="[^"]*\\b${c}\\b`))
  })
})

// Bloc mobile (sous 1024) d'une feuille : jusqu'au bloc 768 s'il existe, sinon jusqu'au suivant ou a la fin.
const tabletOf = (css) => {
  const start = css.indexOf("@media (max-width: 1023.98px)")
  const next = [css.indexOf("@media (max-width: 767.98px)", start), css.indexOf("@media (max-width: 480px)", start), css.indexOf("@container", start)].filter((i) => i > start)
  return css.slice(start, next.length ? Math.min(...next) : undefined)
}
const tablet = tabletOf(STUDENT_BASE)

describe("student : en-tete de sous-page, barre d'action fixe et barre du bas", () => {

  it(".e2-mbar est fixe avec la safe-area, masquee au bureau, affichee sous 1024 ; jamais position: absolute", () => {
    expect(STUDENT_BASE).toMatch(/\.e2-mbar \{[^}]*position: fixed; left: 0; right: 0; bottom: 0; z-index: var\(--z-nav\);[^}]*env\(safe-area-inset-bottom[^}]*display: none;/)
    expect(STUDENT_BASE).not.toMatch(/\.e2-mbar \{[^}]*position: absolute/)
    expect(tablet).toContain(".e2-mbar { display: flex; }")
  })

  it(".e2-mtop est masque au bureau et affiche sous 1024, et remplace .mtop2 sur la page qui le porte", () => {
    expect(STUDENT_BASE).toMatch(/\.e2-mtop \{[^}]*display: none;/)
    expect(tablet).toContain(".e2-mtop { display: flex; }")
    expect(tablet).toContain(".e2:has(.e2-mtop) .mtop2 { display: none; }")
    expect(specificity(".e2:has(.e2-mtop) .mtop2")[1]).toBeGreaterThan(specificity(".mtop2")[1])
  })

  it("app-shell.css masque la barre du bas et reserve la hauteur de .e2-mbar, regles :has seules dans leur liste", () => {
    const shellTablet = SHELL.slice(SHELL.indexOf("@media (max-width: 1023.98px)"))
    expect(shellTablet).toMatch(/\n\s*\.shell--v2:has\(\.e2-mbar\) \.bottom-nav--v2 \{ display: none; \}/)
    expect(shellTablet).toMatch(/\n\s*\.shell--v2:has\(\.e2-mtop\) \.bottom-nav--v2 \{ display: none; \}/)
    expect(shellTablet).toMatch(/\n\s*\.shell--v2:has\(\.e2-mbar\) \.shell__main \{ padding-bottom: calc\(150px \+ env\(safe-area-inset-bottom, 0px\)\); \}/)
    // La reserve de la barre fixe vient APRES celle de la simple sous-page : elle l'emporte a specificite egale.
    expect(shellTablet.indexOf(":has(.e2-mbar) .shell__main")).toBeGreaterThan(shellTablet.indexOf(":has(.e2-mtop) .shell__main"))
    expect(selectorsOf(SHELL).filter((sel) => sel.includes(":has(") && sel.includes(","))).toEqual([])
    // Specificite : (0,3,0) contre .bottom-nav.bottom-nav--v2 (0,2,0) et .shell--v2 .shell__main (0,2,0).
    expect(specificity(".shell--v2:has(.e2-mbar) .bottom-nav--v2")[1]).toBeGreaterThan(specificity(".bottom-nav.bottom-nav--v2")[1])
    expect(specificity(".shell--v2:has(.e2-mbar) .shell__main")[1]).toBeGreaterThan(specificity(".shell--v2 .shell__main")[1])
  })

  it("les toasts passent au-dessus de la barre d'action fixe, comme au-dessus de .mbar2", () => {
    expect(tablet).toContain(".e2:has(.e2-mbar) .toasts--mobile.ds-toasts-fixed { bottom: calc(140px + env(safe-area-inset-bottom, 0px) + var(--s-3)); }")
  })

  it("ne touche pas la capsule RD-NAV-02 : aucune regle etudiante sur .bottom-nav ni .bnav-item", () => {
    expect(STUDENT).not.toMatch(/bottom-nav|bnav-item|bnav2/)
  })

  it("capsule : dans .e2, l'onglet actif reste citron/encre/13 px et les onglets gardent 44 px (40 px a 480), sans libelle rogne", () => {
    const ancestors = ["ds", "e2", "shell", "shell--v2", "shell__main", "bottom-nav", "bottom-nav--v2"]
    const active = computedStyle(RULES_E2, { tag: "a", classes: ["bnav-item", "is-active"], ancestors })
    expect(active.background).toBe("var(--c-citron)")
    expect(active.color).toBe("var(--c-encre)")
    expect(active["font-size"]).toBe("var(--t-micro)")
    expect(active["min-width"]).toBe("44px")
    expect(active.margin).toBe("0")
    const idle = computedStyle(RULES_E2, { tag: "a", classes: ["bnav-item"], ancestors })
    expect(idle["min-width"]).toBe("44px")
    expect(idle.color).toBe("var(--c-brume)")
    // La planche posait min-width: 0 (specificite 0,3,0) : reprise telle quelle, elle aurait ecrase le min-width de la capsule.
    const planche = computedStyle([...RULES_E2, { selector: ".e2 .bottom-nav--v2 .bnav-item", declarations: { "min-width": "0" }, order: 9999 }], { tag: "a", classes: ["bnav-item"], ancestors })
    expect(planche["min-width"]).toBe("0")
    // Libelle actif a 320 px : 4 onglets (aucun bouton central), 3 inactifs de 40 px, capsule de marges 8 px et padding 4 px.
    const label = (screen) => screen - 16 - 8 - 3 * 40 - (24 + 6 + 20)
    expect(label(320)).toBeGreaterThanOrEqual(86) // « Candidatures » (~83 px a 13 px, 800) tient sans ellipse
    expect(label(360)).toBeGreaterThanOrEqual(126)
  })
})

describe("student : cascade statique (specificite et ordre de chargement)", () => {
  const ancestors = ["ds", "e2", "shell", "shell--v2", "shell__main", "money2"]

  it("lien d'evitement : hors ecran au repos, visible avec anneau de focus au focus clavier dans .e2", () => {
    const el = { tag: "a", classes: ["ds-skip-link", "btn", "btn--secondary"], ancestors }
    const rest = computedStyle(RULES_E2, el)
    expect(rest.transform).toBe("translateY(-200%)")
    expect(rest["box-shadow"]).toBe("none")
    const focus = computedStyle(RULES_E2, { ...el, states: ["focus-visible"] })
    expect(focus.transform).toBe("none")
    expect(focus["box-shadow"]).toBe("var(--sh-focus)")
    expect(focus.position).toBe("fixed")
    expect(focus["z-index"]).toBe("var(--z-toast)")
  })

  it("pied de feuille de candidature : .e2-03-sfoot passe en ligne malgre .sheet .modal__foot (meme specificite, charge apres)", () => {
    const foot = computedStyle(RULES_E2, { tag: "div", classes: ["modal__foot", "e2-03-sfoot"], ancestors: ["ds", "e2", "sheet"] })
    expect(foot["flex-direction"]).toBe("row")
    expect(foot["padding-bottom"]).toMatch(/env\(safe-area-inset-bottom/)
    const dark = computedStyle(RULES_E2, { tag: "button", classes: ["btn", "btn--dark"], ancestors: ["ds", "e2", "sheet", "e2-03-sfoot", "modal__foot"] })
    expect(dark.flex).toBe("1")
    expect(dark.width).toBe("auto")
  })

  it("chip : le filet d'un pixel n'annule pas la bordure encre du chip selectionne (3 classes contre 2)", () => {
    const base = { tag: "button", classes: ["chip"], ancestors: ["ds", "e2"] }
    expect(computedStyle(RULES_E2, { ...base, classes: ["chip", "is-selected"] })["border-color"]).toBe("var(--c-encre)")
    expect(computedStyle(RULES_E2, { ...base, states: ["hover"] })["border-color"]).toBe("var(--c-acier)")
    expect(computedStyle(RULES_E2, base).border).toBe("1px solid var(--c-ligne)")
  })

  it("onglet : actif souligne en encre, compteur discret", () => {
    const tab = computedStyle(RULES_E2, { tag: "button", classes: ["tab", "is-active"], ancestors: ["ds", "e2", "tabs"] })
    expect(tab["border-bottom-color"]).toBe("var(--c-encre)")
    expect(tab["border-bottom-width"]).toBe("2px")
    const count = computedStyle(RULES_E2, { tag: "span", classes: ["count"], ancestors: ["ds", "e2", "tab", "is-active"] })
    expect(count.background).toBe("transparent")
  })

  it("bouton icone : le survol givre l'emporte sur le fond transparent de .e2 .btn-icon", () => {
    const el = { tag: "button", classes: ["btn-icon", "btn-icon--sm", "btn-icon--plain"], ancestors: ["ds", "e2", "modal__head"] }
    expect(computedStyle(RULES_E2, el).width).toBe("36px")
    expect(computedStyle(RULES_E2, el).background).toBe("transparent")
    expect(computedStyle(RULES_E2, { ...el, states: ["hover"] }).background).toBe("var(--c-givre)")
  })

  it("carte argent : le bouton « Retirer » inactif prend le fond translucide, pas le fond gris du systeme", () => {
    const el = { tag: "button", classes: ["btn", "btn--ghost-blanc", "btn--sm", "is-disabled"], ancestors }
    expect(computedStyle(RULES_E2, el).background).toBe("color-mix(in srgb, var(--c-blanc) 18%, transparent)")
    expect(computedStyle(RULES_E2, el).color).toBe("var(--c-bleu-100)")
    expect(computedStyle(RULES_E2, { ...el, ancestors: ["ds", "e2"] }).background).toBe("var(--c-off-bg)")
  })

  it("etoiles de notation : encre pleine et survol givre dans .e2 (jamais le citron du systeme)", () => {
    const on = computedStyle(RULES_E2, { tag: "svg", classes: ["is-on"], ancestors: ["ds", "e2", "stars", "stars--input"] })
    expect(on.fill).toBe("var(--c-encre)")
    expect(on.stroke).toBe("var(--c-encre)")
    expect(computedStyle(RULES_E2, { tag: "svg", classes: ["is-hover"], ancestors: ["ds", "e2", "stars", "stars--input"] }).fill).toBe("var(--c-ligne)")
  })

  it("avatar et image d'avatar : rognes dans le cercle dans .e2, zone tactile de l'en-tete mobile rendue visible", () => {
    expect(computedStyle(RULES_E2, { tag: "span", classes: ["av2"], ancestors: ["ds", "e2"] }).overflow).toBe("hidden")
    expect(tablet).toContain(".e2 .mtop2 > a.av2 { overflow: visible; }")
    expect(specificity(".e2 .mtop2 > a.av2")[1]).toBeGreaterThan(specificity(".e2 .av2")[1])
  })

  it("cibles tactiles de 44 px et mouvement reduit sont dans la requete mobile, hors du bloc de base", () => {
    const before = STUDENT_BASE.slice(0, STUDENT_BASE.indexOf("@media"))
    for (const rule of [".e2 .iconbtn2, .e2 .btn-icon, .e2 .btn-icon--sm { width: 44px; height: 44px; }", ".e2-back, .e2-link { min-height: 44px; }", ".e2 .chip { min-height: 44px; }", ".e2-pill { min-height: 44px; }"]) {
      expect(tablet, rule).toContain(rule)
      expect(before, rule).not.toContain(rule)
    }
    const reduced = STUDENT_BASE.slice(STUDENT_BASE.indexOf("@media (prefers-reduced-motion: reduce)"))
    expect(reduced).toMatch(/\.e2, \.e2 \*, \.e2 \*::before, \.e2 \*::after \{[^}]*scroll-behavior: auto !important[^}]*animation-duration: \.01ms !important/)
  })

  it("mise en page : colonnes fluides sans seuil d'ecran, une colonne sous 1024 malgre .e2-02-cols (charge apres)", () => {
    expect(STUDENT_BASE).toMatch(/\.e2-cols \{[^}]*grid-template-columns: minmax\(0, 1fr\) clamp\(280px, 30vw, 360px\)/)
    expect(tablet).toContain(".e2 .e2-cols, .e2 .e2-cols--l { grid-template-columns: minmax(0, 1fr); gap: var(--s-4); }")
    expect(specificity(".e2 .e2-cols")[1]).toBeGreaterThan(specificity(".e2-02-cols")[1])
    const e02 = stripComments(read("student/e02.css"))
    expect(tabletOf(e02)).toContain(".e2 .e2-02-cols { grid-template-columns: minmax(0, 1fr); }")
    expect(tablet).toContain(".e2 .e2-02-filters, .e2 .e2-03-aside, .e2 .e2-05-aside { position: static; }")
    expect(STUDENT_BASE).toMatch(/\.e2-grid3 \{[^}]*repeat\(auto-fill, minmax\(min\(100%, 240px\), 1fr\)\)/)
  })

  it("E04 : sous 900 px de liste, la ligne passe en deux colonnes et ses enfants s'empilent dans la colonne de droite", () => {
    const e04 = stripComments(read("student/e04.css"))
    const compact = e04.match(/@container e2list \(max-width: 900px\) \{([\s\S]*?)\n\}/)?.[1] ?? ""
    expect(compact).toMatch(/\.e2-04-row \{ grid-template-columns: 36px minmax\(0, 1fr\);/)
    expect(compact).toContain(".e2-04-row > :nth-child(n+3) { grid-column: 2; }")
    expect(compact).toContain(".e2-04-acts { justify-content: flex-start; flex-wrap: wrap;")
  })

  it("E06 et E07 : la hauteur suit la fenetre au bureau, une colonne et hauteur libre sous 1024, bas de conversation sur la safe-area", () => {
    const e06 = stripComments(read("student/e06.css"))
    expect(e06).toMatch(/\.e2-06-inbox \{[^}]*height: max\(480px, calc\(100dvh - 244px\)\)/)
    expect(e06).not.toMatch(/\d{3,4}px; min-height: 0;\s*\}/)
    expect(tabletOf(e06)).toContain(".e2-06-inbox, .e2-06-inbox--tall { grid-template-columns: minmax(0, 1fr); height: auto; }")
    const e07 = stripComments(read("student/e07.css"))
    expect(tabletOf(e07)).toContain(".e2:has(.e2-07-mhead) .mtop2 { display: none; }")
    expect(tabletOf(e07)).toMatch(/\.shell--v2:has\(\.e2-07-pane\) \.shell__main \{ padding-bottom: var\(--s-2\); \}/)
    expect(tabletOf(e07)).toMatch(/\.e2-07-pane \{ height: calc\(100dvh - var\(--s-2\)\);/)
  })
})

// `.ds e2` couvre toute page de (student). Les classes de composants v1 « atténuées » par la section 1 de
// student/base.css ne doivent apparaitre dans aucune page sans marqueur @ds-screen qui reviendrait, sinon son rendu
// changerait. Aucune page de ce type n'existe aujourd'hui : le test garde le cas.
describe("anciennes pages etudiant : aucune classe attenuee par .e2", () => {
  const root = path.join(dir, "../../..")
  const walk = (rel) =>
    readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((e) => {
      const child = path.join(rel, e.name)
      if (e.isDirectory()) return walk(child)
      return /\.jsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [child] : []
    })

  const section1 = STUDENT_BASE.slice(0, STUDENT_BASE.indexOf(".e2 .btn-icon {"))
  const softened = [...new Set([...section1.matchAll(/\.e2 \.([A-Za-z][\w-]*)/g)].map((m) => m[1]))].filter((n) => !n.startsWith("e2-"))

  // Plus aucune ancienne page étudiant (RD-STUDENT-01) : toute page sans @ds-screen qui réapparaîtrait est contrôlée ici.
  const legacy = walk("src/app/(student)").filter((f) => !readFileSync(path.join(root, f), "utf8").slice(0, 300).includes("@ds-screen"))

  const classTokens = (source) => {
    const tokens = new Set()
    for (const m of source.matchAll(/className=(?:"([^"]*)"|\{"([^"]*)"\}|\{`([^`]*)`\})/g)) {
      const value = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ")
      for (const t of value.split(/\s+/)) if (t) tokens.add(t)
    }
    return tokens
  }

  it("la liste des classes attenuees est lue et non vide (card, modal, chip, tab, input...)", () => {
    expect(softened).toEqual(expect.arrayContaining(["card", "modal", "chip", "tab", "input", "select"]))
    expect(walk("src/app/(student)").length).toBeGreaterThan(15)
    expect(legacy).toEqual([])
  })

  it("aucune ancienne page ou composant etudiant n'utilise une classe attenuee", () => {
    const offenders = legacy.flatMap((f) => {
      const used = classTokens(readFileSync(path.join(root, f), "utf8"))
      return softened.filter((n) => used.has(n)).map((n) => `${f}: ${n}`)
    })
    expect(offenders).toEqual([])
  })
})

describe("E02 : pied de la feuille de filtres et cibles tactiles sous 1024 px", () => {
  const E02 = stripComments(read("student/e02.css"))
  const narrow = E02.slice(E02.indexOf("@media (max-width: 480px)"))
  const tablet = E02.slice(E02.indexOf("@media (max-width: 1023.98px)"), E02.indexOf("@media (max-width: 480px)"))

  it("le pied passe en colonne sous 480 px, boutons pleine largeur avec min-width 0 (le bouton principal n'est plus rogne)", () => {
    expect(narrow).toMatch(/\.e2-02-sfoot \{ flex-direction: column; align-items: stretch; \}/)
    expect(narrow).toMatch(/\.sheet \.e2-02-sfoot \.btn, \.sheet \.e2-02-sfoot \.btn--dark \{ width: 100%; min-width: 0; flex: none; \}/)
    // Ordre : la regle mobile suit la regle de base `.sheet .e2-02-sfoot .btn--dark { flex: 1 }` (meme specificite).
    expect(E02.indexOf(".sheet .e2-02-sfoot .btn--dark { flex: 1; }")).toBeLessThan(E02.indexOf("@media (max-width: 480px)"))
  })

  it("calcul de largeur : cote a cote le pied demande 347 px, plus que 278 px (320) et 318 px (360), donc la colonne est necessaire", () => {
    const clear = 136
    const primary = 199
    const gap = 12
    const sideBySide = clear + gap + primary
    expect(sideBySide).toBe(347)
    for (const foot of [278, 318]) expect(sideBySide).toBeGreaterThan(foot)
    // En colonne chaque bouton prend la largeur du pied : plus de depassement.
    for (const foot of [278, 318]) expect(Math.max(clear, primary)).toBeLessThanOrEqual(foot)
    // Au-dessus de 480 px la feuille (>= 439 px de pied) garde la ligne.
    expect(sideBySide).toBeLessThanOrEqual(439)
  })

  it("pagination, tri et pastille retirable atteignent 44 px sous 1024 px (zone de 44 px, ecart de rangee de 12 px)", () => {
    expect(tablet).toMatch(/\.e2 \.pagination \.page-btn \{ min-width: 44px; height: 44px; \}/)
    expect(tablet).toMatch(/\.e2 \.e2-02-sort \.select--sm \{ height: 44px; \}/)
    expect(tablet).toMatch(/\.e2-pill\.e2-02-tag::after \{ content: ""; position: absolute; inset: -7px 0; \}/)
    expect(tablet).toMatch(/\.e2 \.e2-02-tags \{ row-gap: 12px; \}/)
    // Pastille : 32 px de bordure a bordure, 30 px de remplissage + 2 x 7 = 44 px ; deux zones voisines (2 x 6 px de debord hors bordure) tiennent dans 12 px d'ecart.
    expect(32 - 2 + 2 * 7).toBe(44)
    expect(2 * (7 - 1)).toBeLessThanOrEqual(12)
  })

  it("le bureau garde les tailles du systeme (aucune regle de 44 px hors media)", () => {
    const base = E02.slice(0, E02.indexOf("@media"))
    expect(base).not.toMatch(/page-btn|select--sm/)
  })
})

describe("E01 et E02 : champ de recherche mobile blanc au repos, sous-lignes sans ellipse", () => {
  const sel = ".e2 .e2-02-msearch:not(:focus-within)"

  it("le champ de recherche mobile est blanc bordé au repos par tokens, sans viser le focus", () => {
    const e02 = stripComments(read("student/e02.css"))
    expect(e02).toContain(`${sel} { background: var(--c-blanc); border-color: var(--c-ligne); }`)
    expect(e02.indexOf(sel)).toBeLessThan(e02.indexOf("@media"))
  })

  it("la regle gagne contre .shell--v2 .search2 (givre) au repos et laisse le focus bleu a .shell--v2 .search2:focus-within", () => {
    // Specificite reelle : .e2 + .e2-02-msearch + :focus-within (argument de :not) = (0,3,0), contre (0,2,0) pour .shell--v2 .search2.
    // (Le compteur statique du fichier ne gere pas :not(), d'ou le calcul ici.)
    expect(3).toBeGreaterThan(specificity(".shell--v2 .search2")[1])
    // Au focus, :not(:focus-within) ne correspond plus : seules .search2:focus-within (bleu) restent.
    expect(sel).toContain(":not(:focus-within)")
    const shell = SHELL.match(/\.shell--v2 \.search2:focus-within, \.shell--v2 \.search2\.is-focus \{ border-color: var\(--c-bleu\); \}/)
    expect(shell).not.toBeNull()
  })

  it("la regle ne vise que l'espace etudiant : aucune regle client ou coquille ne change", () => {
    expect(sel.startsWith(".e2 ")).toBe(true)
    expect(CLIENT).not.toContain("e2-02-msearch")
    expect(SHELL).toContain(".shell--v2 .search2 { background: var(--c-givre); border-color: var(--c-givre); }")
  })

  it("les sous-lignes de rangee (item2__sub) passent a la ligne sous 1024 px dans .e2, sans toucher .c2", () => {
    const tablet = STUDENT_BASE.slice(STUDENT_BASE.indexOf("@media (max-width: 1023.98px)"), STUDENT_BASE.indexOf("@media (max-width: 767.98px)"))
    expect(tablet).toContain(".e2 .stat2__sub, .e2 .money2 .stat2__sub, .e2 .item2__sub { white-space: normal; overflow: visible; text-overflow: clip; }")
    expect(SHELL).not.toMatch(/\.c2 \.item2__sub/)
    // Le bureau garde l'ellipse (la regle est sous media, hors du chargeur de cascade statique).
    expect(computedStyle(RULES_E2, { tag: "div", classes: ["item2__sub"], ancestors: ["ds", "e2"] })["white-space"]).toBe("nowrap")
    // Calcul : « Aucune mission en cours, aucun avis a laisser » (264 px de texte) ne tient pas sur 206 px (320) ni 246 px (360) : retour a la ligne.
    for (const room of [206, 246]) expect(264).toBeGreaterThan(room)
  })
})

describe("E06 et E07 : exception documentee aux composants du systeme (fond, bordure, ombre)", () => {
  // Exception limitee a ces deux regles, meme precedent que le client (client/c13.css sous .c2) : elles modifient
  // le fond, la bordure ou l'ombre d'un composant du systeme parce que le rendu par defaut est inutilisable ici.
  // - .e2-06-search : le champ givre de .shell--v2 .search2 est invisible sur le fond givre de la liste mobile ;
  // - .composer__field:focus-within : le champ de saisie doit montrer son focus (filet bleu et anneau).
  // Le bouton d'envoi n'est plus desactive : il remplace le micro des que le champ contient du texte (RD-FIDELITE-01).
  // Toute autre regle de ce type dans e06.css ou e07.css reste a justifier : ne pas elargir cette liste.
  const e06 = stripComments(read("student/e06.css"))
  const e07 = stripComments(read("student/e07.css"))

  it("garde les deux regles necessaires, portees sur des classes de l'espace etudiant", () => {
    expect(e06).toContain(".e2 .e2-06-search:not(:focus-within) { background: var(--c-blanc); border-color: var(--c-ligne); }")
    expect(e07).toContain(".e2-07-composer .composer__field:focus-within { background: var(--c-blanc); border-color: var(--c-bleu); box-shadow: var(--sh-champ-focus); }")
    expect(e07).not.toContain(".composer__send:disabled")
  })

  it("l'exception reste limitee a EXACTEMENT deux regles : aucune autre regle d'etat d'un composant du systeme ne pose fond, bordure ou ombre", () => {
    // Une regle d'exception restyle l'etat d'un composant du systeme (champ ou bouton) : sa cible porte l'etat
    // :focus-within ou :disabled et elle pose un fond, une bordure ou une ombre. Les regles de mise en page propres a
    // .e2-06-* et .e2-07-* (cartes, bulles, fenetre) ne portent jamais ces etats.
    const POSES = /(?:^|;)\s*(?:background(?:-color)?|border(?:-[a-z-]+)?|box-shadow)\s*:/
    const STATE = /:(?:focus-within|disabled)\b/
    const rulesOf = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim().replace(/\s+/g, " "), body }))
    const exceptions = [...rulesOf(e06), ...rulesOf(e07)].filter(({ selector, body }) => STATE.test(selector) && POSES.test(body))
    expect(exceptions.map(({ selector }) => selector)).toEqual([
      ".e2 .e2-06-search:not(:focus-within)",
      ".e2-07-composer .composer__field:focus-within",
    ])
    // Le detecteur voit une troisieme regle du meme type (cas temoin).
    const witness = rulesOf(".e2-07-composer .composer__field:disabled { background: red; } .e2-07-pane { background: red; }")
    expect(witness.filter(({ selector, body }) => STATE.test(selector) && POSES.test(body))).toHaveLength(1)
  })
})

// RD-FIX-01 : aucun trait au-dessus d'une rangée qui défile horizontalement (défaut mobile signalé sur C14).
describe("rangees defilantes : pas de trait au-dessus", () => {
  const c14 = stripComments(read("client/c14.css"))
  // Bloc @media mobile uniquement : coupe à l'accolade fermante équivalente (les @container qui suivent en sont exclus).
  const mediaBlock = (css, query) => {
    const start = css.indexOf(query)
    const open = css.indexOf("{", start)
    let depth = 0
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++
      else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1)
    }
    return css.slice(start)
  }
  const phone = mediaBlock(c14, "@media (max-width: 767.98px)")
  const base = stripComments(read("client/base.css"))
  const components = stripComments(read("components.css"))
  const componentsRoot = path.join(dir, "..", "..", "components")
  const srcRoot = path.join(componentsRoot, "client-space")
  // Ce qui peut suivre un .list2__head : une rangée div (filters2, tabs...) ou un composant qui pose lui-même la rangée.
  const FOLLOWER = /className="list2__head"[\s\S]{0,400}?<\/div>\s*(?:<div className="([^"]*\b(?:filters2|tabs|chips--scroll|segmented)\b[^"]*)"|<(ChipFilter|TabsNav)\b)/g
  const ROW = /^(filters2|tabs|chips--scroll|segmented)$/
  const COMPONENT_ROW = { ChipFilter: "chips--scroll", TabsNav: "tabs" }
  const followers = (text) =>
    [...text.matchAll(FOLLOWER)].map(([, cls, comp]) => (comp ? COMPONENT_ROW[comp] : cls.split(" ").find((c) => ROW.test(c))))
  const jsxFiles = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? jsxFiles(path.join(d, e.name)) : /\.jsx$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(d, e.name)] : [],
    )
  const sources = [srcRoot, path.join(componentsRoot, "app-ui")].flatMap((root) =>
    jsxFiles(root).map((f) => [path.relative(componentsRoot, f), readFileSync(f, "utf8")]),
  )

  it("C14 : l'en-tete de l'historique perd son trait sur mobile quand les filtres defilent juste apres", () => {
    expect(phone).toMatch(/\.list2__head:has\(\+ \.filters2\) \{ border-bottom: 0; \}/)
    // la rangée défilante n'a elle-même aucune bordure haute ni basse sur mobile
    expect(phone).toMatch(/\.filters2 \{[^}]*overflow-x: auto;[^}]*border: 0;/)
    // .filters2 est le vrai conteneur défilant (.filters2 .chips--scroll est en overflow visible) : barre masquée comme .tabs / .chips--scroll
    expect(phone).toMatch(/\.filters2 \{[^}]*scrollbar-width: none;/)
  })

  it("le trait de l'en-tete n'est retire qu'en mobile : bureau et tablette gardent leur separateur", () => {
    const outsidePhone = c14.replace(phone, "")
    expect(outsidePhone).not.toMatch(/list2__head:has/)
    expect(SHELL).toMatch(/\n\.list2__head \{[^}]*border-bottom: 1px solid var\(--c-ligne\);/)
    expect(c14).toMatch(/\n\.filters2 \{[^}]*border-bottom: 1px solid var\(--c-ligne\);/)
  })

  it("chaque .list2__head suivi d'une rangee de filtres defilante dans le JSX client est neutralise en CSS", () => {
    const pairs = sources.flatMap(([file, text]) => followers(text).map((row) => [file, row]))
    expect(pairs.length).toBeGreaterThan(0)
    for (const [, row] of pairs) expect(phone).toContain(`.list2__head:has(+ .${row}) { border-bottom: 0; }`)
  })

  it("detection des rangees qui suivent un .list2__head (cas temoins)", () => {
    const head = '<div className="list2__head"><h2>Titre</h2></div>\n'
    expect(followers(`${head}<TabsNav label="x" items={t} />`)).toEqual(["tabs"])
    expect(followers(`${head}<div className="tabs">`)).toEqual(["tabs"])
    expect(followers(`${head}<div className="filters2 other">`)).toEqual(["filters2"])
    expect(followers(`${head}<ChipFilter options={o} />`)).toEqual(["chips--scroll"])
    expect(followers(`${head}<div className="stack">`)).toEqual([])
    expect(followers(`${head}<div className="tabsy">`)).toEqual([])
    expect(followers(`${head}<p>texte</p>`)).toEqual([])
  })

  it("la tranche mobile s'arrete au bloc media (les @container suivants en sont exclus)", () => {
    const css = "a{x:1}\n@media (max-width: 767.98px) {\n  .a { b: 1; }\n}\n@container q (max-width: 1px) {\n  .moved { c: 2; }\n}"
    const block = mediaBlock(css, "@media (max-width: 767.98px)")
    expect(block).toContain(".a { b: 1; }")
    expect(block).not.toContain("@container")
    expect(block).not.toContain(".moved")
    expect(phone).not.toContain("@container")
  })

  it("les onglets .tabs (C02 missions, C04 detail) et la rangee .chips--scroll ne suivent jamais un .list2__head", () => {
    for (const [file, text] of sources) {
      expect(followers(text), file).not.toContain("tabs")
    }
    // le trait des onglets est leur ligne de base, sous la rangée (jamais au-dessus)
    expect(components).toMatch(/\n\.tabs \{[^}]*border-bottom: var\(--b-ligne\);/)
    expect(components).not.toMatch(/\n\.tabs \{[^}]*border-top/)
    expect(base).toMatch(/\.c2 \.tabs \{ border-bottom: 1px solid var\(--c-ligne\); \}/)
    expect(base).not.toMatch(/\.c2 \.tabs \{[^}]*border-top/)
    expect(components).not.toMatch(/\n\.chips--scroll \{[^}]*border/)
  })
})

// Recette finale RD-STUDENT-01 (D1 a D7) : garde de structure des correctifs mesures a 320, 360, 390, 768 et 1024 px.
describe("recette finale : portefeuille, recapitulatif, compteur, edition du profil, cibles et focus", () => {
  const e03 = stripComments(read("student/e03.css"))
  const e07 = stripComments(read("student/e07.css"))
  const e08 = stripComments(read("student/e08.css"))
  const e11 = stripComments(read("student/e11.css"))
  const e04 = stripComments(read("student/e04.css"))
  const base = stripComments(read("student/base.css"))
  const block = (css, query) => {
    const start = css.indexOf(query)
    expect(start, query).toBeGreaterThan(-1)
    const open = css.indexOf("{", start)
    let depth = 0
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++
      else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1)
    }
    return css.slice(start)
  }

  it("D1 : le titre d'une ligne d'operation passe a la ligne sous 1024 px et le montant s'empile sous 480 px (seuils existants)", () => {
    const tablet = block(e08, "@media (max-width: 1023.98px)")
    expect(tablet).toMatch(/\.e2-08-op \.item2__title \{ white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; \}/)
    const phone = block(e08, "@media (max-width: 480px)")
    expect(phone).toMatch(/\.e2-08-op \.e2-op__amount \{ grid-column: 2 \/ -1;[^}]*flex-direction: row;[^}]*flex-wrap: wrap;/)
    expect(phone).toMatch(/\.e2-08-op \.e2-op__amount small \{ white-space: normal; \}/)
    expect(e08).toMatch(/\.e2-08-op > div:nth-child\(2\) \{ min-width: 0; \}/)
    // Aucun nouveau seuil : seuls 1023.98 et 480 apparaissent.
    expect([...new Set([...e08.matchAll(/@media \(max-width: ([\d.]+)px\)/g)].map((m) => m[1]))].sort()).toEqual(["1023.98", "480"])
  })

  it("D1 : calcul de la colonne texte (320 et 390 px) une fois le montant empile", () => {
    // largeur ecran - 2 x 16 (page2) - 2 x 16 (ligne) - 32 (icone) - 12 (espace) ; le montant n'occupe plus la colonne
    const text = (screen) => screen - 32 - 32 - 32 - 12
    expect(text(320)).toBe(212)
    expect(text(390)).toBe(282)
    // avant : colonne montant ~ 110 px ("sur 25 000 FCFA bloques") et espace de 12 px, soit moins de 121 px a 390 px
    expect(text(390) - 110 - 12).toBeLessThan(170)
    expect(text(320)).toBeGreaterThan(160)
  })

  it("D2 : les valeurs du recapitulatif coupent un mot sans espace au lieu de deborder", () => {
    expect(base).toMatch(/\.e2-kv__row > b, \.e2-kv__row > span:last-child \{ min-width: 0; overflow-wrap: anywhere; \}/)
  })

  it("D3 : le compteur de caracteres de la motivation ne se coupe jamais sur deux lignes", () => {
    expect(e03).toMatch(/\.e2-03-ta \.field__count, \.e2-03-ta--s \.field__count \{ white-space: nowrap; flex: none; \}/)
  })

  it("D4 : la barre d'enregistrement passe a la ligne au lieu d'ecraser le message, le formulaire garde 200 px par colonne", () => {
    expect(e11).toMatch(/\.e2-11-save \{[^}]*flex-wrap: wrap;/)
    expect(e11).toMatch(/\.e2-11-save__info \{ flex: 1 1 180px; min-width: 0;/)
    expect(base).toMatch(/\.e2-form \{[^}]*repeat\(auto-fit, minmax\(min\(100%, 200px\), 1fr\)\)[^}]*align-items: start;/)
  })

  it("D4 : le champ Etablissement occupe toute la grille du formulaire (au moins 330 px a 768 et 1440)", () => {
    const form = read("../../components/student-space/profile/profile-form.jsx")
    expect(form).toMatch(/<SelectField\s+className="e2-span"\s+label="Établissement"/)
    expect(base).toContain(".e2-form .e2-span { grid-column: 1 / -1; }")
    // largeur mesuree d'une colonne a 2 colonnes (213 px a 768, 224 px a 1440) : le champ pleine largeur = 2 colonnes + ecart (--s-5 = 20 px)
    const full = (col) => 2 * col + 20
    expect(full(213)).toBe(446)
    expect(full(224)).toBe(468)
    expect(full(213)).toBeGreaterThanOrEqual(330)
    expect(full(224)).toBeGreaterThanOrEqual(330)
    // en une colonne (sous 768 px) la grille garde une seule colonne, le span reste valable
    expect(block(base, "@media (max-width: 767.98px)")).toMatch(/\.e2-form \{ grid-template-columns: minmax\(0, 1fr\);/)
  })

  it("D5 : le lien Voir des candidatures en cours a une zone de 44 px de large sous 1024 px, sans changer la mise en page", () => {
    const tablet = block(e04, "@media (max-width: 1023.98px)")
    expect(tablet).toContain(".e2-04-acts .e2-link { min-width: 44px; }")
    expect(e04.slice(0, e04.indexOf("@media"))).not.toContain(".e2-04-acts .e2-link { min-width")
  })

  it("D5 : zones tactiles de 44 px sous 1024 px, sans toucher a la coquille partagee", () => {
    const tablet = block(base, "@media (max-width: 1023.98px)")
    expect(tablet).toContain(".e2 .item2__action { min-width: 44px; }")
    expect(tablet).toMatch(/\.e2-op \.item2__title \.link::after \{ content: ""; position: absolute; inset: -12px 0; \}/)
    expect(e07).toContain(".e2-07-composer .composer__field { box-sizing: border-box; min-height: 44px; padding: 0 16px; }")
    expect(block(e07, "@media (max-width: 1023.98px)")).toContain(".e2-07-composer .iconbtn2, .e2-07-composer .composer__send { width: 44px; height: 44px; }")
    // la zone des pastilles de filtres actives est elargie par ::after (inset -7px 0 sur 32 px = 46 px)
    expect(stripComments(read("student/e02.css"))).toMatch(/\.e2-pill\.e2-02-tag::after \{ content: ""; position: absolute; inset: -7px 0; \}/)
    // le logo et l'avatar de la barre du haut (coquille partagee) gardent leur regle existante
    expect(tablet).toContain(".e2 .mtop2 > a::after { content: \"\"; position: absolute; inset: -6px; }")
  })

  it("D7 : anneau systeme sur les liens de cartes et sortie visible des champs, par des regles .e2", () => {
    expect(base).toMatch(/\.e2 \.link:focus-visible, \.e2 \.list2__more:focus-visible[^{]*\{ outline: none; box-shadow: var\(--sh-focus\);/)
    expect(base).toMatch(/\.e2 textarea:not\(\.input\):not\(\.composer__input2\):focus-visible[^{]*\{ outline: 2px solid var\(--c-bleu\);/)
    // aucune regle ne vise la coquille partagee (.nav2, .bnav2, .shell)
    const rule = base.slice(base.indexOf(".e2 .link:focus-visible"), base.indexOf("/* Focus visible des"))
    expect(rule).not.toMatch(/nav2|bnav2|shell/)
  })
})

// =====================================================================================================
// Espace admin (RD-ADMIN-01 ST-01) : admin.css + admin/*.css, port de v2-admin.css (portee .v2a -> .a2).
// Memes controles que pour student/*.css (couleurs, variables, seuils, portee, ordre mobile, 13 px), plus la
// presence de chaque classe de la source, la barre d'action fixe et le respect de la capsule RD-NAV-02.
// =====================================================================================================

const ADMIN_FILES = readdirSync(path.join(dir, "admin")).filter((f) => f.endsWith(".css")).sort()
const ADMIN_FILE_CSS = ADMIN_FILES.map((f) => stripComments(read(`admin/${f}`)))
const ADMIN = ADMIN_FILE_CSS.join("\n")
const ADMIN_BASE = stripComments(read("admin/base.css"))
const ADMIN_IMPORTS = [...read("admin.css").matchAll(/@import "\.\/(admin\/[\w-]+\.css)";/g)].map((m) => m[1])
const ADMIN_SCREENS = ["ad01", "ad02", "ad03", "ad04", "ad06", "ad07", "ad09", "ad10", "ad11", "ad12", "ad13"]

// Classes des selecteurs de v2-admin.css (la planche), au renommage ds- pres, moins REMOVED_A2 et RENAMED_A2.
const ADMIN_SOURCE_CLASSES = `
a-install a-object action-bar ad-av--citron ad-av--lavande ad-av--menthe ad-av--peche ad-av--rose ad-compare ad-diff__new
ad-diff__old ad-hbar ad-hbar--citron ad-hbar--encre ad-hbar--lavande ad-hbar__track ad-idcard ad-idcard__band ad-idcard__pin
ad-indic ad-kbd ad-legend ad-log ad-payreq ad-payreq__proofs ad-prio ad-prio--haute ad-prio--moy ad-proof ad-proof__ic
ad-proof__lab ad-proof__note ad-proof__sms ad-ro ad-row-prio ad-setting ad-setting__val ad-stage ad-steps ad-subnav
ad-typeconfirm ad-vchart__bar ad-vchart__plot ad-viewer ad-viewer__tools ad07-payreq ad12-money applicant avatar avatar-btn
badge--citron badge--contour badge--encre badge--lavande badge--plein-bleu banner banner--alerte banner--citron banner--encre
banner__title bento-card bento-card__shape btn btn--accent btn--danger-outline btn--ghost btn--primary btn--secondary btn-icon
btn-icon--plain btn-icon__count btn-icon__dot btn__dot c-inbox c-payreq card card--citron card--citron-pale card--hl
card--lavande card--link card--menthe card--peche card--rose card--sm chat-status chip chip--remove choice control count
count--citron count--erreur count--neutre detail-card drawer e-achat e-inbox__list e-inbox__pane e-inbox__pane-head
e-success__mark empty--erreur empty--sm empty__art empty__title file head2__actions head2__back head2__sub head2__title ic
ic-sq ic-sq--alerte ic-sq--blanc ic-sq--erreur ic-sq--succes input is-active is-current is-disabled is-done is-error
is-flagged is-hl is-hover is-on is-selected is-serie is-unread lrow lrow--citron lrow--lavande lrow--menthe lrow--peche
lrow__ic lrows menu mission mission--hl mission--link modal modal--danger modal__icon modal__title msg-system mtopbar
mtopbar--admin mtopbar--white notif notif-panel notif-panel__foot photo-ph push recap recap__total scribble search search2
searchbar searchbar__icon segmented select sheet stat stat--citron stat--encre stat--lavande stat--link stat--menthe
stat--peche stat--rose stat2 stat__label stat__shape stat__sub stat__trend stat__value step step__dot sticker t-paycard
t-paycard__photo t-warn tab table table-wrap table-wrap__foot table-wrap__head tabs tcard tl-item tl-item__dot toast
toast--erreur toast--succes toast__action toast__icon verified verified--citron
`.trim().split(/\s+/)

// Classes de la section 2 de la planche renommees : l'ancien nom ne doit plus apparaitre, le nouveau doit exister.
const RENAMED_A2 = {
  filters2: "a2-filters", filters2__count: "a2-filters__count", full2: "a2-full",
  full2__actions: "a2-full__actions", full2__code: "a2-full__code", full2__text: "a2-full__text", grid2: "a2-grid",
  "grid2--3": "a2-grid--3", kv2: "a2-kv", "mtop2--sub": "a2-mtop", mtop2__title: "a2-mtop__title",
  note2: "a2-note", "note2--alerte": "a2-note--alerte", "note2--erreur": "a2-note--erreur", "note2--succes": "a2-note--succes",
  prio2: "a2-prio", "prio2--haute": "a2-prio--haute", "prio2--moy": "a2-prio--moy", sec2: "a2-sec", sec2__head: "a2-sec__head",
  sec2__more: "a2-sec__more", sec2__title: "a2-sec__title", split2: "a2-split", "split2--md": "a2-split--md",
  "split2--wide": "a2-split--wide",
}
// Classes de la planche volontairement non portees, avec la raison.
const REMOVED_A2 = {
  "ad-chat": "lecture de conversation par l'admin : hors perimetre (donnee personnelle sans trace d'acces, AD07 sans messages)",
  chat: "conversation en lecture seule (.ad-chat .chat) : hors perimetre",
  bubble__meta: "conversation en lecture seule (.ad-chat) : hors perimetre",
  "bubble--me": "conversation en lecture seule (.ad-chat) : hors perimetre",
  state__canvas: "cadre d'etat propre aux planches, aucun equivalent dans l'application",
  "ad10-proofs": "AD10 (detail de signalement) : ecran hors lot, aucun signalement dans le code",
  "ad14-bars": "AD14 (statistiques) : ecran hors lot",
  "ad14-hatch": "AD14 (statistiques) : ecran hors lot",
  "ad-hbar": "n'apparait que dans une regle AD14 (.ad14-bars .ad-hbar.is-serie), ecran hors lot ; les variantes --citron, --encre et --lavande sont portees",
  chart2: "histogramme retire d'AD01 (decision v2.1) ; AD14 hors lot ; la hauteur des barres exigeait un style local",
  chart2__bar: "histogramme retire d'AD01 ; hauteur par style local interdite",
  chart2__empty: "histogramme retire d'AD01 ; hauteur par style local interdite",
  chart2__plot: "histogramme retire d'AD01 ; hauteur par style local interdite",
  chart2__y: "histogramme retire d'AD01 ; hauteur par style local interdite",
  "is-serie": "etat de serie de l'histogramme et de sa legende : retire avec eux",
  legend2: "legende d'histogramme : retiree avec l'histogramme",
  mpage2: "T02 et AD15 (parametres) : ecrans hors lot",
  t03: "T03 (page derriere la modale) : transverse hors lot",
  "t03-behind": "T03 (page derriere la modale) : transverse hors lot",
  "t04-m": "T04 (introuvable) mobile : transverse hors lot",
  "t05-safe": "T05 (erreur) : reprise sous le nom a2-full__safe",
  "t05-title": "T05 (maintenance) : ecran hors lot",
  "t06-cache": "T06 (hors ligne) : transverse hors lot, la bannière hors ligne est celle d'app-ui",
  "t07-progress": "T07 (demarrage) : transverse hors lot",
  flag2: "n'apparait que dans une regle T05 (.full2 > .flag2) hors lot ; la classe vient d'app-shell.css",
  table: "renomme ds-table (anti-collision Tailwind)", "table-wrap": "renomme ds-table-wrap (anti-collision Tailwind)",
  "table-wrap__foot": "renomme ds-table-wrap__foot", "table-wrap__head": "renomme ds-table-wrap__head",
}
const ADMIN_CLASSES = ADMIN_SOURCE_CLASSES.filter((c) => !(c in REMOVED_A2))

describe("feuilles admin.css et admin/*.css", () => {
  it("admin.css importe chaque feuille de admin/ une fois, base en premier, puis un fichier par ecran dans l'ordre", () => {
    expect(ADMIN_IMPORTS[0]).toBe("admin/base.css")
    expect([...ADMIN_IMPORTS.map((f) => f.replace("admin/", ""))].sort()).toEqual(ADMIN_FILES)
    expect(new Set(ADMIN_IMPORTS).size).toBe(ADMIN_IMPORTS.length)
    expect(ADMIN_FILES).toEqual([...ADMIN_SCREENS.map((s) => `${s}.css`), "base.css"])
    expect(ADMIN_IMPORTS.slice(1)).toEqual(ADMIN_SCREENS.map((s) => `admin/${s}.css`))
  })

  it("est branche dans globals.css en couche components, apres student.css", () => {
    const globals = readFileSync(path.join(dir, "..", "globals.css"), "utf8")
    expect(globals).toContain('@import "./design/admin.css" layer(components);')
    const order = ["tokens.css", "components.css", "layouts.css", "app-shell.css", "client.css", "student.css", "admin.css"].map((f) => globals.indexOf(`./design/${f}`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("chaque feuille porte le marqueur @ds-screen RD-ADMIN-01 en tete", () => {
    for (const f of ADMIN_FILES) expect(read(`admin/${f}`).startsWith("/* @ds-screen RD-ADMIN-01 */"), f).toBe(true)
  })

  it("contient chaque classe de v2-admin.css (renommages ds- et a2- pres), les retraits etant documentes", () => {
    const renamedSources = new Set(Object.keys(RENAMED_A2))
    const own = ADMIN_CLASSES.filter((c) => !renamedSources.has(c))
    expect(own.filter((c) => !hasClass(ADMIN, c) && !c.startsWith("ds-"))).toEqual([])
    expect(Object.values(RENAMED_A2).filter((n) => !hasClass(ADMIN, n))).toEqual([])
    expect(Object.keys(RENAMED_A2).filter((c) => hasClass(ADMIN, c))).toEqual([])
    expect(Object.keys(REMOVED_A2).filter((c) => hasClass(ADMIN, c))).toEqual([])
    for (const reason of Object.values(REMOVED_A2)) expect(reason.length).toBeGreaterThan(10)
  })

  it("applique le renommage ds- (table) et la portee .a2 a la place de body.v2a", () => {
    expect(ADMIN).toContain(".a2 .ds-table-wrap")
    expect(ADMIN).toContain(".a2 .ds-table td")
    expect(ADMIN).toContain(".a2 .ds-table-wrap__foot")
    expect(ADMIN).not.toMatch(/\.table(?![\w-])/)
    expect(ADMIN).not.toMatch(/v2a/)
    expect(ADMIN).toMatch(/\.a2 \.card \{ border: 1px solid var\(--c-ligne\); box-shadow: none; \}/)
  })

  it("ne contient aucune couleur en dur (hex, rgb, rgba, hsl) ni de nom de couleur CSS nu", () => {
    expect(ADMIN).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(ADMIN).not.toMatch(/\b(?:rgba?|hsla?)\(/)
    expect(ADMIN).not.toMatch(/:\s*(?:white|black|red|green|blue)\s*[;}]/)
  })

  it("ne contient aucun !important hors mouvement reduit, aucune ombre dure ni attribut de style", () => {
    const outsideMotion = ADMIN.replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g, "")
    expect(outsideMotion).not.toMatch(/!important/)
    for (const m of ADMIN.matchAll(/box-shadow:\s*([^;}]+)/g)) {
      expect(m[1].trim(), m[0]).toMatch(/^(?:none|var\(--sh-[\w-]+\)|inset [^;]*var\(--c-[\w-]+\)|inset 3px 0 0 var\(--c-[\w-]+\)|inset 0 0 0 1px var\(--c-[\w-]+\))$/)
    }
  })

  it("n'utilise que des variables definies dans les feuilles du systeme", () => {
    const defined = new Set()
    for (const f of [...DESIGN_CSS, "student.css", ...STUDENT_FILES.map((x) => `student/${x}`), "admin.css", ...ADMIN_FILES.map((x) => `admin/${x}`)]) {
      for (const m of read(f).matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1])
    }
    const used = new Set([...ADMIN.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))
    expect([...used].filter((v) => !defined.has(v))).toEqual([])
  })

  it("ne reutilise aucun nom d'utilitaire Tailwind comme classe propre ni de classe deja definie ailleurs", () => {
    const own = [...classNamesOf(ADMIN)].filter((c) => /^a2-/.test(c))
    expect(own.length).toBeGreaterThan(50)
    expect(own.filter((n) => TAILWIND_BARE.has(n))).toEqual([])
    expect(own.filter((n) => /^-?(?:m|p|w|h|gap|space|text|bg|border|rounded|col|row)[trblxy]?-\d/.test(n))).toEqual([])
    const before = [read("components.css"), read("layouts.css"), read("app-shell.css"), ...CLIENT_FILES.map((f) => read(`client/${f}`)), ...STUDENT_FILES.map((f) => read(`student/${f}`))].join("\n")
    // app-shell.css cite .a2-mtop et .a2-mbar a dessein (regles :has de la coquille) : ces deux noms sont exclus.
    expect(own.filter((n) => !/^a2-(?:mtop|mbar)/.test(n) && hasClass(before, n))).toEqual([])
    const noShell = [read("components.css"), read("layouts.css"), ...CLIENT_FILES.map((f) => read(`client/${f}`)), ...STUDENT_FILES.map((f) => read(`student/${f}`))].join("\n")
    expect(own.filter((n) => hasClass(noShell, n))).toEqual([])
  })

  it("garde chaque regle sous .a2 ou sur une classe propre (aucun changement de rendu des pages existantes)", () => {
    const offenders = []
    for (const sel of selectorsOf(ADMIN)) {
      for (const part of sel.split(",").map((p) => p.trim())) {
        if (part === ".a2" || part.startsWith(".a2 ") || part.startsWith(".a2:")) continue
        const names = [...part.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1])
        if (!names.some((n) => /^a2-/.test(n))) offenders.push(part)
      }
    }
    expect(offenders).toEqual([])
  })

  it("n'utilise que les seuils de media query 1023.98, 767.98 et 480 (plus le mouvement reduit), sans min-width ni conteneur", () => {
    const conditions = [...ADMIN.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim())
    const allowed = ["(max-width: 1023.98px)", "(max-width: 767.98px)", "(max-width: 480px)", "(prefers-reduced-motion: reduce)"]
    expect(conditions.filter((c) => !allowed.includes(c))).toEqual([])
    for (const a of allowed) expect(conditions).toContain(a)
    expect(ADMIN).not.toMatch(/@media[^{]*\bmin-width/)
    expect(ADMIN).not.toMatch(/@container/)
  })

  it("range les regles mobiles apres les regles de base de leur propre fichier", () => {
    for (const css of ADMIN_FILE_CSS) {
      const firstMedia = css.search(/@(?:media|container)/)
      if (firstMedia === -1) continue
      const outside = css.slice(firstMedia).replace(AT_BLOCK, "")
      expect(outside.trim()).toBe("")
    }
  })

  it("n'utilise aucune font-size en px inferieure a 13 et protege toute taille relative", () => {
    const sizes = [...ADMIN.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
    expect(sizes.length).toBeGreaterThan(0)
    expect(sizes.filter((px) => px < 13)).toEqual([])
    expect(relativeSizeOffenders(ADMIN)).toEqual([])
  })

  it("chaque ecran du lot a sa feuille, sans regle hors de sa propre racine .a2-NN ni de .a2 .adNN-", () => {
    for (const s of ADMIN_SCREENS) {
      const n = s.slice(2)
      const css = stripComments(read(`admin/${s}.css`))
      const root = new RegExp(`^\\.a2-${n}(?:[\\s.:-]|$)|^\\.a2 \\.(?:a2-${n}|ad${n}-|ad-|tl-item|a2-${n})`)
      const bad = selectorsOf(css).flatMap((sel) => sel.split(",").map((p) => p.trim())).filter((p) => !root.test(p))
      expect(bad, s).toEqual([])
    }
  })

  it("les sources du systeme (components.css) definissent deja les classes .ad-* reprises par .a2 (aucune n'est redefinie en hors-portee)", () => {
    const system = read("components.css")
    for (const c of ["ad-idcard", "ad-kvl", "ad-stage", "ad-actions", "ad-viewer", "ad-md", "ad-review"]) expect(hasClass(system, c), c).toBe(true)
    for (const c of ["ad-idcard", "ad-kvl", "ad-stage", "ad-actions", "ad-viewer", "ad-md", "ad-review"]) {
      const bare = selectorsOf(ADMIN).flatMap((sel) => sel.split(",").map((p) => p.trim())).filter((p) => new RegExp(`^\\.${c}(?![\\w-])`).test(p))
      expect(bare, c).toEqual([])
    }
  })
})

describe("admin : barre d'action fixe, en-tete de sous-page et coquille", () => {
  it(".a2-mbar est fixe avec la safe-area, masquee au bureau, affichee sous 1024 ; jamais position: absolute", () => {
    const rule = ADMIN_BASE.match(/\.a2-mbar \{([^}]*)\}/)[1]
    expect(rule).toMatch(/position: fixed/)
    expect(rule).toMatch(/env\(safe-area-inset-bottom/)
    expect(rule).toMatch(/display: none/)
    expect(rule).not.toMatch(/position: absolute/)
    const tablet = tabletOf(ADMIN_BASE)
    expect(tablet).toMatch(/\.a2-mbar \{ display: flex; \}/)
    expect(tablet).toMatch(/\.a2-mtop \{ display: flex; \}/)
    expect(ADMIN_BASE).toMatch(/\.a2-mtop \{[^}]*display: none/)
  })

  it("sous 1024 l'en-tete .a2-mtop remplace .mtop2 et les toasts passent au-dessus de la barre d'action", () => {
    const tablet = tabletOf(ADMIN_BASE)
    expect(tablet).toContain(".a2:has(.a2-mtop) .mtop2 { display: none; }")
    expect(tablet).toMatch(/\.a2:has\(\.a2-mbar\) \.toasts--mobile\.ds-toasts-fixed \{ bottom: calc\(140px \+ env\(safe-area-inset-bottom, 0px\) \+ var\(--s-3\)\); \}/)
  })

  it("la coquille masque la capsule RD-NAV-02 sur un dossier ouvert et reserve la hauteur de la barre d'action", () => {
    const shell = stripComments(read("app-shell.css"))
    expect(shell).toContain(".shell--v2:has(.a2-mtop) .bottom-nav--v2 { display: none; }")
    expect(shell).toContain(".shell--v2:has(.a2-mbar) .bottom-nav--v2 { display: none; }")
    expect(shell).toContain(".shell--v2:has(.a2-mbar) .shell__main { padding-bottom: calc(150px + env(safe-area-inset-bottom, 0px)); }")
    // La capsule elle-meme n'est pas modifiee par les feuilles admin.
    expect(ADMIN).not.toMatch(/\.bottom-nav|\.bnav-item/)
  })

  it("le lien d'evitement a les memes regles sous .a2 que sous .c2 et .e2", () => {
    const shell = stripComments(read("app-shell.css"))
    for (const sel of ["a.ds-skip-link { transform: translateY(-200%); box-shadow: none; }", "a.ds-skip-link:focus, .a2 a.ds-skip-link:focus-visible { transform: none; }"]) {
      expect(shell).toContain(`.a2 ${sel}`)
    }
    expect(shell).toMatch(/\.a2 a\.ds-skip-link:focus-visible \{ position: fixed; left: var\(--s-2\); top: var\(--s-2\); z-index: var\(--z-toast\); outline: none; box-shadow: var\(--sh-focus\); \}/)
  })

  it("les regles .a2 d'app-shell.css n'ont modifie aucune regle .c2 ni .e2 (memes valeurs que les regles jumelles)", () => {
    const shell = stripComments(read("app-shell.css"))
    const twin = (scope) => shell.match(new RegExp(`\\.${scope} a\\.ds-skip-link \\{[^}]*\\}`))[0].replace(`.${scope} `, "")
    expect(twin("a2")).toBe(twin("c2"))
    expect(twin("a2")).toBe(twin("e2"))
  })

  it("tableaux : une classe .a2-tlist les passe en liste sous 768 (en-tete masquee, libelle par cellule)", () => {
    const m768 = ADMIN_BASE.slice(ADMIN_BASE.indexOf("@media (max-width: 767.98px)"))
    expect(m768).toMatch(/\.a2 \.a2-tlist thead \{[^}]*clip-path/)
    expect(m768).toMatch(/\.a2 \.a2-tlist td::before \{ content: attr\(data-label\);/)
    expect(m768).toMatch(/\.a2 \.a2-tlist, \.a2 \.a2-tlist tbody, \.a2 \.a2-tlist tr, \.a2 \.a2-tlist td \{ display: block;/)
  })

  it("cibles tactiles de 44 px sous 1024 et mouvement reduit sous .a2", () => {
    const tablet = tabletOf(ADMIN_BASE)
    for (const sel of [".a2 .chip { min-height: 44px; }", ".a2 .btn--sm { min-height: 44px; }", ".a2 .iconbtn2, .a2 .btn-icon, .a2 .btn-icon--sm { width: 44px; height: 44px; }"]) {
      expect(tablet).toContain(sel)
    }
    expect(ADMIN_BASE).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.a2, \.a2 \*, \.a2 \*::before, \.a2 \*::after \{[^}]*scroll-behavior: auto/)
  })

  it("dossier AD02 : zoom et rotation par attributs data, la carte ne deborde pas, la liste cede la place au dossier sous 1024", () => {
    const ad02 = stripComments(read("admin/ad02.css"))
    for (const z of ["150", "200", "300"]) expect(ad02).toContain(`.a2-02-img[data-zoom="${z}"]`)
    for (const r of ["90", "180", "270"]) expect(ad02).toContain(`.a2-02-img[data-rot="${r}"]`)
    expect(ad02).toMatch(/\.a2-02-stage \{[^}]*overflow: auto/)
    expect(ad02).toMatch(/\.a2-02--open \.a2-02-master \{ display: none; \}/)
    expect(ad02).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.a2-02-img \{ transition: none; \}/)
  })

  it("AD02 planche v1 : bouton principal bleu par a2-02-cta seulement, la regle encre commune reste vraie", () => {
    const ad02 = stripComments(read("admin/ad02.css"))
    expect(ad02).toMatch(/\.a2 \.a2-02 \.a2-02-cta \{[^}]*background: var\(--c-bleu\);[^}]*color: var\(--c-blanc\);/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.a2-02-cta:hover \{[^}]*background: var\(--c-bleu-700\)/)
    expect(ad02).not.toMatch(/\.btn--primary/)
    expect(ADMIN_BASE).toMatch(/\.a2 \.btn--primary \{ background: var\(--c-encre\); color: var\(--c-blanc\); \}/)
    const colors = parseColorTokens(read("tokens.css"))
    expect(contrastRatio(colors["--c-blanc"], colors["--c-bleu"])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors["--c-blanc"], colors["--c-bleu-700"])).toBeGreaterThanOrEqual(4.5)
  })

  it("AD02 planche v1 : ligne ouverte lavande, pastille contour, legende bleue, bandeaux succes et alerte", () => {
    const ad02 = stripComments(read("admin/ad02.css"))
    expect(ad02).toMatch(/\.a2-02-row\[aria-current="true"\] \{[^}]*background: var\(--c-lavande\)/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.badge--contour \{ border: 1px solid var\(--c-encre\); \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.ad-legend b \{ background: var\(--c-bleu\); \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.banner--succes \{ background: var\(--c-succes-bg\)/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.banner--alerte \{ background: var\(--c-alerte-bg\)/)
    const colors = parseColorTokens(read("tokens.css"))
    for (const [fg, bg] of [["--c-encre", "--c-lavande"], ["--c-ardoise", "--c-lavande"], ["--c-encre", "--c-succes-bg"], ["--c-encre", "--c-alerte-bg"], ["--c-encre", "--c-citron"]]) {
      expect(contrastRatio(colors[fg], colors[bg]), `${fg} sur ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("AD02 planche v1 : la frise reprend le style v1 sous .a2 .a2-02, plus specifique que ad07.css", () => {
    const ad02 = stripComments(read("admin/ad02.css"))
    const ad07 = stripComments(read("admin/ad07.css"))
    expect(ad07).toMatch(/\.a2 \.tl-item\.is-done \.tl-item__dot \{/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.tl-item\.is-done \.tl-item__dot \{[^}]*background: var\(--c-encre\);[^}]*color: var\(--c-citron\)/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.tl-item\.is-current \.tl-item__dot \{[^}]*background: var\(--c-citron\);[^}]*color: var\(--c-encre\)/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.tl-item\.is-error \.tl-item__dot \{[^}]*background: var\(--c-erreur-bg\)/)
    expect(ad02).not.toMatch(/(^|\n)\.tl-item/)
  })

  it("AD02 planche v1 : cibles de 44 px sous 1024, decisions dans la barre fixe, pas de couleur en dur", () => {
    const ad02 = stripComments(read("admin/ad02.css"))
    const tablet = tabletOf(ad02)
    expect(tablet).toContain(".a2 .a2-02 .switch { min-height: 44px; }")
    expect(tablet).toContain(".a2 .a2-02 .a2-02-cta { min-height: 44px; }")
    expect(tablet).toContain(".a2-02-actions__btns { display: none; }")
    // Pagination de la file : 40 px au bureau (components.css), 44 px sous 1024.
    expect(tablet).toContain(".a2 .a2-02 .pagination .page-btn { min-width: 44px; min-height: 44px; }")
    expect(ad02).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })

  it("AD02 v1 fidele : onglet actif bleu, liste en lignes givre arrondies, ligne ouverte bordure encre et ombre dure", () => {
    const ad02 = stripComments(read("admin/ad02.css"))
    expect(ad02).toMatch(/\.a2 \.a2-02 \.tab\.is-active \{ border-bottom-color: var\(--c-bleu\); \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.tab\.is-active \.count \{ background: var\(--c-bleu\); color: var\(--c-blanc\); \}/)
    expect(ad02).toMatch(/\.a2-02-list \{[^}]*gap: var\(--s-2\)/)
    expect(ad02).not.toMatch(/\.a2-02-list \{[^}]*(?:background|border)/)
    expect(ad02).toMatch(/\.a2-02-row \{[^}]*background: var\(--c-givre\);[^}]*border: 2px solid transparent;[^}]*border-radius: 18px/)
    expect(ad02).not.toMatch(/\.a2-02-row \+ \.a2-02-row/)
    expect(ad02).toMatch(/\.a2-02-row\[aria-current="true"\] \{[^}]*border-color: var\(--c-encre\);[^}]*box-shadow: var\(--sh-dur-s\)/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.a2-02-row \.lrow__ic \{ background: var\(--c-blanc\); color: var\(--c-encre\); \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.search \{ width: 300px; max-width: 100%; \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.a2-02-sort \{ cursor: default; \}/)
  })

  it("AD02 v1 fidele : carte du dossier a bordure encre, visionneuse sur encre, cases bleues, Refuser a bordure erreur", () => {
    const ad02 = stripComments(read("admin/ad02.css"))
    expect(ad02).toMatch(/\.a2 \.a2-02 \.a2-02-dossier \{ border: var\(--b-encre\); \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.ad-viewer \{ background: var\(--c-encre\); border: 0; \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.ad-viewer__tools \{ color: var\(--c-brume\); \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.ad-viewer__tools \.btn-icon \{ background: transparent; border-color: var\(--c-blanc\); color: var\(--c-blanc\); \}/)
    expect(ad02).toMatch(/\.btn-icon:focus-visible \{[^}]*box-shadow: var\(--sh-focus-sombre\)/)
    expect(ad02).toMatch(/\.btn-icon:disabled \{[^}]*color: var\(--c-brume\)/)
    expect(ad02).toMatch(/\.a2-02-stage \{[^}]*background: var\(--c-encre-700\);[^}]*border: 0/)
    expect(ad02).toMatch(/\.a2-02-viewer:fullscreen \{[^}]*background: var\(--c-encre\)/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.check input:checked, \.a2 \.a2-02 \.check\.is-checked input \{ background-color: var\(--c-bleu\); border-color: var\(--c-bleu\); \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.btn--danger-outline \{ border: 2px solid var\(--c-erreur\);/)
    expect(ad02).not.toMatch(/\.btn--primary/)
  })

  it("AD02 v1 fidele : bannieres, etat vide menthe et modales avec icone, bordure encre et ombre du systeme", () => {
    const ad02 = stripComments(read("admin/ad02.css"))
    expect(ad02).toMatch(/\.a2 \.a2-02 \.banner--erreur \{ background: var\(--c-erreur-bg\); border-color: var\(--c-erreur\); \}/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.banner--info \{ background: var\(--c-bleu-50\)/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.banner--alerte-doux \{ background: var\(--c-alerte-bg\)/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.empty__art \.ic-sq--menthe \{ background: var\(--c-menthe\); color: var\(--c-encre\); border: var\(--b-encre\);/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.modal__icon \{ display: inline-grid;/)
    expect(ad02).not.toMatch(/\.modal__icon \{[^}]*display: none/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.modal \{ border: var\(--b-encre\); box-shadow: var\(--sh-dur-xl\);/)
    expect(ad02).toMatch(/\.a2 \.a2-02 \.modal--danger \{ border-color: var\(--c-erreur\); box-shadow: var\(--sh-dur-xl\); \}/)
    expect(ad02).toMatch(/\.a2-02-missing \{/)
    expect(ad02).toMatch(/\.a2-02-mkv \{/)
  })

  it("AD02 v1 fidele : sous 1024 le dossier ouvert est pleine largeur, sans avatar, lien vers la fiche visible de 44 px, titre de la taille ad-mtitle", () => {
    const ad02 = stripComments(read("admin/ad02.css"))
    const tablet = tabletOf(ad02)
    expect(tablet).toMatch(/\.a2 \.a2-02 \.a2-02-dossier \{ border: 0; background: transparent; padding: 0; \}/)
    expect(tablet).toMatch(/\.a2 \.a2-02 \.a2-02-avatar \{ display: none; \}/)
    // « Ouvrir la fiche » est le seul chemin vers la fiche sur tablette et mobile : jamais masque, zone de 44 px.
    expect(ad02).not.toMatch(/\.a2-02-dossier__status \.link[^{]*\{[^}]*display: none/)
    expect(ad02).not.toMatch(/\.a2-02-dossier__status[^{]*\{[^}]*display: none/)
    expect(tablet).toMatch(/\.a2 \.a2-02 \.a2-02-dossier__status \.link \{[^}]*display: inline-flex;[^}]*min-height: 44px;/)
    expect(tablet).toMatch(/\.a2 \.a2-02 \.a2-02-dossier__name \{ font-size: var\(--t-h3\); font-weight: var\(--fw-xbold\); \}/)
    expect(tablet).toMatch(/\.a2 \.a2-02 \.search \{ width: 100%; \}/)
  })

  it("AD02 v1 fidele : contrastes de la visionneuse sombre et des fonds v1 >= 4,5:1", () => {
    const colors = parseColorTokens(read("tokens.css"))
    for (const [fg, bg] of [["--c-brume", "--c-encre"], ["--c-blanc", "--c-encre-700"], ["--c-encre", "--c-lavande"], ["--c-encre", "--c-menthe"], ["--c-ardoise", "--c-givre"]]) {
      expect(contrastRatio(colors[fg], colors[bg]), `${fg} sur ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("couleurs semantiques : les anomalies restent en citron/erreur par tokens, jamais d'accent hors tokens", () => {
    const colors = parseColorTokens(read("tokens.css"))
    expect(contrastRatio(colors["--c-ardoise"], colors["--c-blanc"])).toBeGreaterThanOrEqual(4.5)
    expect(ADMIN_BASE).toMatch(/\.a2 \.btn--primary \{ background: var\(--c-encre\); color: var\(--c-blanc\); \}/)
    expect(ADMIN_BASE).toMatch(/\.a2 \.btn--danger-outline \{[^}]*color: var\(--c-erreur\)/)
    expect(ADMIN_BASE).toMatch(/\.a2 \.badge--citron, \.a2 \.badge--lavande \{ background: var\(--c-ligne\); color: var\(--c-encre\); \}/)
  })
})

// =====================================================================================================
// Centre de notifications (RD-NOTIF-01 ST-06) : notifications.css. Les classes du systeme (.notif,
// .notif-panel*, .segmented, .iconbtn2, .ic-sq, .btn--dark, .link) ne sont pas redefinies : seules les
// classes ntf-* sont propres a la feuille, et chaque regle en porte au moins une (aucun effet sur les
// autres pages).
// =====================================================================================================

describe("notifications.css : feuille du centre de notifications", () => {
  const NOTIFICATIONS = stripComments(read("notifications.css"))
  const globals = readFileSync(path.join(dir, "..", "globals.css"), "utf8")

  it("est branchee dans globals.css en couche components, apres admin.css", () => {
    expect(globals).toContain('@import "./design/notifications.css" layer(components);')
    expect(globals.indexOf("./design/notifications.css")).toBeGreaterThan(globals.indexOf("./design/admin.css"))
  })

  it("ne contient aucune couleur en dur ni de nom de couleur nu", () => {
    expect(NOTIFICATIONS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(NOTIFICATIONS).not.toMatch(/\b(?:rgba?|hsla?)\(/)
    expect(NOTIFICATIONS).not.toMatch(/:\s*(?:white|black|red|green|blue)\s*[;}]/)
  })

  it("n'utilise que des variables definies et aucun token d'erreur (aucun rouge dans ce lot)", () => {
    const defined = new Set()
    for (const f of DESIGN_CSS) for (const m of read(f).matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1])
    const used = [...NOTIFICATIONS.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(used.filter((v) => !defined.has(v))).toEqual([])
    expect(used.filter((v) => /erreur|danger/.test(v))).toEqual([])
  })

  it("chaque regle porte une classe ntf-* (aucune regle globale sur une classe du systeme)", () => {
    const offenders = []
    for (const sel of selectorsOf(NOTIFICATIONS)) {
      for (const part of sel.split(",").map((p) => p.trim())) {
        if (!/\.ntf-[\w-]+/.test(part)) offenders.push(part)
      }
    }
    expect(offenders).toEqual([])
  })

  it("n'utilise que les seuils 1023.98 et 479.98 et aucune taille de police sous 13 px", () => {
    const conditions = [...NOTIFICATIONS.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim())
    expect(conditions.filter((c) => !["(max-width: 1023.98px)", "(max-width: 479.98px)"].includes(c))).toEqual([])
    for (const m of NOTIFICATIONS.matchAll(/font-size:\s*([\d.]+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(13)
  })

  it("le point des non lues reste bleu sur fond transparent (pas de fond bleu) et le panneau est borne a la fenetre", () => {
    expect(NOTIFICATIONS).toMatch(/\.notif\.ntf-item\.is-unread \{ background: transparent; \}/)
    expect(NOTIFICATIONS).toMatch(/\.ntf-pop \{[^}]*width: min\(420px, calc\(100vw - 32px\)\)/)
  })

  it("garde des zones de toucher de 44 px sous 1024 px pour la cloche et les actions", () => {
    const tablet = NOTIFICATIONS.slice(NOTIFICATIONS.indexOf("@media (max-width: 1023.98px)"))
    expect(tablet).toMatch(/\.ntf-bell-link\.iconbtn2 \{ width: 44px; height: 44px; \}/)
    expect(tablet).toMatch(/\.ntf-item \.link, \.ntf-item \.btn \{ min-height: 44px;/)
  })
})

describe("E05 : modale « J'ai terminé » au-dessus de la barre du haut", () => {
  const e05 = read("student/e05.css")
  it("l'aside sticky ouvert sur une modale passe au niveau --z-modal (contexte d'empilement)", () => {
    expect(e05).toMatch(/\.e2-05-aside:has\(\.scrim\)\s*\{\s*z-index:\s*var\(--z-modal\);\s*\}/)
    expect(read("tokens.css")).toMatch(/--z-modal:\s*50/)
  })
  it("la largeur 560 px de la modale reste portée par `.e2-05-end .modal` (et `.e2-05-modal`, classe de la planche)", () => {
    expect(e05).toContain(".e2-05-end .modal { width: 560px; }")
    expect(e05).toContain(".e2-05-modal { width: 560px; }")
  })
})

describe("C13 : badge de la demande de paiement", () => {
  const css = read("client/c13.css")

  it("l'en-tete passe a la ligne et le badge ne sort pas de la carte", () => {
    expect(css).toMatch(/\.c2 \.c-payreq__head \{[^}]*flex-wrap: wrap/)
    expect(css).toMatch(/\.c2 \.c-payreq__head > div \{[^}]*min-width: 0/)
    expect(css).toMatch(/\.c2 \.c-payreq__head \.badge \{[^}]*flex: none[^}]*max-width: 100%/)
  })
})
