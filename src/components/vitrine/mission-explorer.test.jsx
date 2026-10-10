import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { SORTS } from "@/lib/constants/missions"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/missions",
  useSearchParams: () => new URLSearchParams(),
}))

const { MissionFilterBar, MissionSearch } = await import("./mission-explorer")

// Barre mobile seule (bloc .v02-mbar), pour ne pas confondre avec la barre bureau.
const mobileBar = (html) => {
  const start = html.indexOf("v02-mbar")
  return html.slice(start, html.indexOf("</div>", html.indexOf('class="caption"', start)))
}

describe("MissionFilterBar, barre mobile (non-régression débordement à 360-390 px)", () => {
  it("affiche le tri et le compteur compacts de la maquette V02", () => {
    const html = renderToStaticMarkup(
      <MissionFilterBar total={128} countLabel="128 missions ouvertes" countShort="128 missions" />,
    )
    const bar = mobileBar(html)
    expect(bar).toContain("<span>Récentes</span>")
    expect(bar).not.toContain("<span>Plus récentes</span>")
    expect(bar).toContain(">128 missions</span>")
    expect(bar).not.toContain("ouvertes")
    // La barre bureau garde les libellés longs.
    expect(html).toContain("<span>Plus récentes</span>")
    expect(html).toContain("128 missions ouvertes")
  })

  it("tous les tris ont un libellé court, plus court que le libellé complet", () => {
    for (const s of SORTS) {
      expect(s.short).toBeTruthy()
      expect(s.short.length).toBeLessThanOrEqual(12)
      expect(s.short.length).toBeLessThan(s.label.length)
    }
  })

  it("la barre mobile peut passer à la ligne au lieu de déborder", () => {
    const css = readFileSync(path.resolve(import.meta.dirname, "../../app/design/layouts.css"), "utf8")
    expect(css).toMatch(/\.v02-mbar\s*\{[^}]*flex-wrap:\s*wrap/)
  })
})

describe("libellés de types", () => {
  it("les puces de type affichent les libellés, sans mot banni dans les placeholders", () => {
    const html = renderToStaticMarkup(<MissionSearch />)
    expect(html).toContain("Marché et achats")
    expect(html).toContain("Démarches et files d&#x27;attente")
    expect(html).not.toContain(">Livraison<")
    expect(html).not.toContain(">Saisie<")
    expect(html).not.toMatch(/placeholder="[^"]*(livraison|saisie)/i)
  })

  it("la pastille de filtre actif affiche le libellé du type", () => {
    const html = renderToStaticMarkup(<MissionFilterBar type="Livraison" />)
    expect(html).toContain("Retirer le filtre Marché et achats")
    expect(html).not.toContain("Retirer le filtre Livraison")
  })
})
