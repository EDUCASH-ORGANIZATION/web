import { describe, it, expect, vi } from "vitest"
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { states as c01 } from "./fixtures/c01-dashboard.js"
import { states as c02 } from "./fixtures/c02-missions.js"

vi.mock("next/link", () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }))
vi.mock("next/navigation", () => ({ usePathname: () => "/client/missions", useRouter: () => ({ refresh() {}, push() {} }), useSearchParams: () => new URLSearchParams() }))

const { ClientDashboardView } = await import("@/components/client-space/dashboard/client-dashboard-view")
const { ClientMissionsView } = await import("@/components/client-space/missions-list/client-missions-view")

const ROOT = "src/app/(client)/client"
function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) { const p = join(dir, n); statSync(p).isDirectory() ? walk(p, acc) : acc.push(p) }
  return acc
}

describe("segments : pas de loading.js au-dessus d'un notFound()", () => {
  it("aucun loading.js sous client/missions ni client/missions/[id]", () => {
    const files = walk(join(ROOT, "missions"))
    expect(files.filter((f) => /loading\.(js|jsx|tsx)$/.test(f))).toEqual([])
    expect(existsSync(join(ROOT, "missions/[id]/not-found.js"))).toBe(true)
    expect(existsSync(join(ROOT, "missions/[id]/loading.js"))).toBe(false)
  })
  it("loading.js du tableau de bord reste dans son segment et n'appelle pas notFound", async () => {
    expect(existsSync(join(ROOT, "loading.js"))).toBe(false)
    const src = (await import("node:fs")).readFileSync(join(ROOT, "dashboard/loading.js"), "utf8")
    expect(src).not.toMatch(/notFound/)
  })
})

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ")
const TU = /\b(tu|toi|ton|ta|tes|t'|te|vérifie|clique|choisis|ajoute|confirme|examine|annule|prolonge)\b/i
const BANNED = /livraison|livrer|livrée|\bcourses?\b|coursier|bientôt|prestataire|total dépensé|à faire cette semaine/i

describe("rendu : vouvoiement, mots bannis, tirets, emoji, un seul h1", () => {
  const dashStates = Object.entries(c01).map(([k, v]) => [`dashboard ${k}`, () => renderToStaticMarkup(<ClientDashboardView {...v} />)])
  const missStates = Object.entries(c02).map(([k, v]) => [`missions ${k}`, () => renderToStaticMarkup(<ClientMissionsView result={v} />)])
  for (const [name, render] of [...dashStates, ...missStates]) {
    it(name, () => {
      const html = render()
      const t = text(html)
      expect(t).not.toMatch(/[—–]/)
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u)
      // les titres de missions des fixtures (données) sont exclus du contrôle de mots bannis et de tutoiement
      const ui = t.replace(/(Saisie de 200 fiches clients|Livraison de documents à Ganhi|Livrer 12 colis entre Ganhi et Cadjèhoun|Traduire un flyer en anglais|Cours de maths niveau 3e|Garde de deux enfants samedi soir|Garde d'enfants mercredi après-midi|Inventaire du stock de pagnes)/g, " ")
      expect(ui).not.toMatch(BANNED)
      expect(ui.match(TU)?.[0] ?? null, ui).toBeNull()
      expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1)
      expect(html).not.toMatch(/style="/)
      expect(html).not.toMatch(/#(2F3BED|C8F03C|0E0F1A|1A6B4A)/i)
    })
  }
  it("paiements coupés : aucun lien ni bouton Recharger / Retirer / wallet", () => {
    for (const k of ["decisions-paiements-coupes", "nouveau-client-coupes", "solde-insuffisant-coupes"]) {
      const html = renderToStaticMarkup(<ClientDashboardView {...c01[k]} />)
      expect(html, k).not.toMatch(/recharger=1/)
      expect(html.match(/href="\/client\/wallet[^"]*"/g) ?? [], k).toEqual([])
      expect(html, k).not.toMatch(/<(a|button)[^>]*>\s*(Recharger|Retirer)/)
    }
  })
  it("citron : seulement flag2 (aucune autre classe citron dans le HTML rendu)", () => {
    for (const [k, v] of Object.entries(c01)) {
      const html = renderToStaticMarkup(<ClientDashboardView {...v} />)
      expect(html.match(/class="[^"]*citron[^"]*"/g) ?? [], k).toEqual([])
    }
  })
})
