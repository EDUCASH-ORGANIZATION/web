import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { CLIENT_NAV } from "@/components/client-space/shell/client-nav"
import { STUDENT_NAV } from "@/components/student-space/shell/student-nav"
import { ADMIN_NAV } from "@/components/admin-space/shell/admin-nav"

// QA RD-FIX-13 : navbar fixe, aucun defilement interne des barres, budget de hauteur reel par role.
const dir = import.meta.dirname
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "")
const rulesIn = (file) =>
  [...strip(readFileSync(path.join(dir, file), "utf8")).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ file, selector: m[1].trim(), body: m[2] }))
const sheets = [
  "layouts.css",
  "components.css",
  "app-shell.css",
  ...["student", "client", "admin"].flatMap((d) => readdirSync(path.join(dir, d)).filter((f) => f.endsWith(".css")).map((f) => `${d}/${f}`)),
]
const all = sheets.flatMap(rulesIn)
const SCROLL = /overflow(?:-[xy])?:\s*(?:auto|scroll)/
const lastCompound = (part) => part.trim().split(/[\s>+~]+/).pop()

describe("RD-FIX-13 QA : aucune barre de la coquille ne defile", () => {
  // Inclut layouts.css, components.css, les feuilles .e2, .c2 et .a2.
  const BAR = /\.(?:sidebar|sidebar__nav|sidebar__me|sidebar__foot|sidebar__brand|top2|topbar|mtop2|e2-mtop|a2-mtop|c2-mtop|bottom-nav|bottom-nav--v2|bnav|shell__frame)(?![\w-])/
  it("aucune regle overflow auto/scroll ne vise directement une barre (toutes feuilles, y compris .a2 et .c2)", () => {
    const offenders = all
      .filter((r) => r.selector.split(",").some((p) => BAR.test(lastCompound(p))))
      .filter((r) => SCROLL.test(r.body))
      .map((r) => `${r.file} ${r.selector}`)
    expect(offenders).toEqual([])
  })

  it("aucun overflow auto/scroll sur le cadre ni sur le conteneur .shell--v2 / .shell__main", () => {
    const offenders = all
      .filter((r) => r.selector.split(",").some((p) => /^(?:\.shell--v2|\.shell|\.shell__main|\.shell__frame|\.shell--v2 \.shell__frame|\.shell--v2 \.shell__main)$/.test(p.trim())))
      .filter((r) => SCROLL.test(r.body))
      .map((r) => `${r.file} ${r.selector}`)
    expect(offenders).toEqual([])
  })

  it("aucune regle ne reintroduit overflow-x auto/scroll sur un conteneur de navigation de la sidebar", () => {
    const offenders = all
      .filter((r) => r.selector.split(",").some((p) => /(?:^|[\s>+~])\.(?:sidebar|sidebar__nav|nav-item)(?![\w-])/.test(p.trim()) && !/\.(?:tabs|chips)/.test(p)))
      .filter((r) => /overflow-x:\s*(?:auto|scroll)|overflow:\s*(?:auto|scroll)/.test(r.body))
      .map((r) => `${r.file} ${r.selector}`)
    expect(offenders).toEqual([])
  })

  it("les feuilles admin (.a2) ne ciblent ni .sidebar ni .nav-item ni .sidebar__nav avec un overflow", () => {
    const adminRules = ["admin/base.css", ...readdirSync(path.join(dir, "admin")).filter((f) => f.endsWith(".css")).map((f) => `admin/${f}`)].flatMap(rulesIn)
    const hit = adminRules.filter((r) => /\.(?:sidebar|nav-item|sidebar__nav)(?![\w-])/.test(r.selector) && /overflow/.test(r.body))
    expect(hit.map((r) => `${r.file} ${r.selector}`)).toEqual([])
  })

  it("aucune regle ne remet un overflow sur .sidebar autre que hidden/clip, meme en media query", () => {
    const side = all.filter((r) => r.selector.split(",").some((p) => lastCompound(p) === ".sidebar"))
    for (const r of side) {
      for (const m of r.body.matchAll(/overflow(?:-[xy])?:\s*([a-z-]+)/g)) {
        expect(["hidden", "clip"], `${r.file} ${r.selector}`).toContain(m[1])
      }
    }
  })
})

describe("RD-FIX-13 QA : positions sticky / fixed", () => {
  const body = (file, sel) => rulesIn(file).filter((r) => r.selector.split(",").some((p) => p.trim() === sel)).map((r) => r.body).join(" ")
  it("sidebar sticky, top2 et mtop2 sticky en haut, barre du bas fixed", () => {
    expect(body("app-shell.css", ".shell--v2 .sidebar")).toMatch(/position:\s*sticky/)
    expect(body("app-shell.css", ".shell--v2 .top2")).toMatch(/position:\s*sticky/)
    expect(body("app-shell.css", ".shell--v2 .mtop2")).toMatch(/position:\s*sticky/)
    expect(body("app-shell.css", ".bottom-nav.bottom-nav--v2")).toMatch(/position:\s*fixed/)
  })
  it("aucune regle ne repasse la sidebar en position static/relative/absolute sous .shell--v2", () => {
    const bad = rulesIn("app-shell.css")
      .filter((r) => r.selector.split(",").some((p) => /^\.shell--v2 \.sidebar$/.test(p.trim())))
      .filter((r) => /position:\s*(?:static|relative|absolute)/.test(r.body))
    expect(bad).toEqual([])
  })
})

describe("RD-FIX-13 QA : budget de hauteur de la sidebar, trois roles, a 600, 700 et 900 px", () => {
  const clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v))
  // Constantes reprises de la feuille (verifiees ci-dessous), comptes reels issus des modeles de navigation.
  const count = (nav) => ({
    items: nav.groups.reduce((n, g) => n + g.items.length, 0),
    groups: nav.groups.filter((g) => g.title).length,
    cta: Boolean(nav.cta),
  })
  const used = (h, { items, groups, cta }) => {
    const padTop = clamp(12, (h - 600) / 4 + 12, 24)
    const brand = 40 + 6 + 19.5 + clamp(8, (h - 600) / 4 + 8, 24)
    const ctaH = cta ? 36 + 12 : 0
    const group = clamp(8, (h - 600) / 4 + 8, 20) + 19.5 + 6
    const item = clamp(32, (h - 600) / 8 + 34, 42)
    const nav = items * item + groups * group + (items + groups - 1) * 2
    const me = 12 + 40 + 2 + 2
    return padTop + brand + 2 + ctaH + nav + 2 + me + 12
  }
  it("les constantes du modele correspondent a la feuille", () => {
    const css = strip(readFileSync(path.join(dir, "app-shell.css"), "utf8"))
    expect(css).toContain("clamp(32px, calc((100dvh - 600px) / 8 + 34px), 42px)")
    expect(css).toContain("clamp(var(--s-2), calc((100dvh - 600px) / 4 + var(--s-2)), var(--s-6))")
    expect(css).toContain("clamp(var(--s-2), calc((100dvh - 600px) / 4 + var(--s-2)), var(--s-5))")
    expect(css).toContain("clamp(var(--s-3), calc((100dvh - 600px) / 4 + var(--s-3)), var(--s-6))")
  })
  for (const [role, nav] of [["client", CLIENT_NAV], ["etudiant", STUDENT_NAV], ["admin", ADMIN_NAV]]) {
    for (const h of [600, 700, 900]) {
      it(`${role} : contenu <= hauteur disponible a ${h} px (sans badge de compteur qui change la hauteur)`, () => {
        const c = count(nav)
        expect(c.items).toBeGreaterThan(3)
        expect(used(h, c)).toBeLessThanOrEqual(h - 60)
      })
    }
  }
  it("la hauteur de la liste de navigation est monotone : jamais plus haute quand la fenetre est plus basse", () => {
    for (const nav of [CLIENT_NAV, STUDENT_NAV, ADMIN_NAV]) {
      const c = count(nav)
      let prev = 0
      for (let h = 400; h <= 1200; h += 20) {
        const u = used(h, c)
        expect(u).toBeGreaterThanOrEqual(prev)
        prev = u
      }
    }
  })
})
