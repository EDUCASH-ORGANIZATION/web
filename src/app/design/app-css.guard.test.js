import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

// Garde-fou des feuilles v2.1 (RD-CLIENT-01 ST-01) : coquille connectee
// (app-shell.css) et espace client (client.css + client/*.css).

const dir = import.meta.dirname
const read = (rel) => readFileSync(path.join(dir, rel), "utf8")
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "")

const CLIENT_FILES = readdirSync(path.join(dir, "client")).filter((f) => f.endsWith(".css")).sort()
const SHELL = stripComments(read("app-shell.css"))
const CLIENT = CLIENT_FILES.map((f) => stripComments(read(`client/${f}`))).join("\n")
const ALL = `${SHELL}\n${CLIENT}`
const DESIGN_CSS = ["tokens.css", "components.css", "layouts.css", "app-shell.css", "client.css", ...CLIENT_FILES.map((f) => `client/${f}`)]

// Classes des sources (shell-v2.css et fragments v2-client), au renommage ds- pres.
const SHELL_CLASSES = `
agenda2 app2 av2 av2--sm bnav-item bnav-item__dot bnav2 bnav2__count bnav2__item bottom-nav--v2
btn--blanc btn--block btn--sidebar btn--soft cal2 cal2__day cal2__dow cal2__grid cal2__head
cal2__legend cal2__month card2 card2--m count day2 day2--m day2__count day2__head day2__name
duo2 flag2 flag2--neutre has-due head2 head2__date head2__title hero2 hero2--m hero2__actions
hero2__col hero2__figure hero2__label hero2__link hero2__meta hero2__text hero2__title ic
iconbtn2 iconbtn2__dot is-active is-focus is-hover is-out is-today item2 item2__action item2__ic
item2__meta item2__sub item2__title list2 list2--m list2__head list2__more list2__title logo
logo-sym main2 mapp2 money2 money2--m money2--split money2__head mpage2 mtop2 mtop2__space nav-item nav2 nav2__count page2 row2 search2 shell--v2 shell__main side2 side2__brand side2__cta
side2__foot side2__group side2__me side2__space sidebar__brand sidebar__group sidebar__me
sidebar__space skel2-hero skel2-row skel2-stats slot2 stat2 stat2__label stat2__sub stat2__value
stats2 stats2--m step2 step2--done top2 top2__actions top2__stamp v2-tag week2 week2__d
`.trim().split(/\s+/)

const CLIENT_CLASSES = `
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
    if (!sel.startsWith("@")) out.push(sel)
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
  "btn--soft", "btn--sidebar", "btn--blanc", "btn--ghost-blanc", "sidebar__me", "v2-tag", "has-due",
  "ds-toasts-fixed", "ds-drawer--full", "ds-stars__btn",
])
const isNew = (c) => NEW_CLASS.test(c) || NEW_SYSTEM.has(c)

describe("feuilles app-shell.css et client/*.css", () => {
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

  it("range les regles mobiles apres les regles de base de leur propre fichier", () => {
    for (const css of [SHELL, ...CLIENT_FILES.map((f) => stripComments(read(`client/${f}`)))]) {
      const firstMedia = css.indexOf("@media")
      if (firstMedia === -1) continue
      const rest = css.slice(firstMedia)
      const outside = rest.replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "")
      expect(outside.trim()).toBe("")
    }
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

describe("regles des primitives interactives (app-ui)", () => {
  it("fournit toasts fixes, tiroir plein ecran, bouton d'etoile et focus clavier tab/chip limite a .c2 et .shell--v2", () => {
    expect(SHELL).toMatch(/\.ds-toasts-fixed \{[^}]*position: fixed/)
    expect(SHELL).toMatch(/\.toasts--mobile\.ds-toasts-fixed \{[^}]*bottom: calc\(64px \+ env\(safe-area-inset-bottom/)
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
