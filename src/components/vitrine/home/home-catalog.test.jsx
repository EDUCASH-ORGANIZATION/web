import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { MISSION_TYPES, missionTypeLabel } from "@/lib/constants/missions"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const { HomeCatalog } = await import("./home-catalog")

const html = renderToStaticMarkup(<HomeCatalog />)
const cards = [...html.matchAll(/<a href="([^"]*)"[^>]*class="(v-cat[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
  href: m[1],
  className: m[2],
  body: m[3],
}))

// Texte visible : sans balises ni valeurs d'URL (type=Livraison reste la valeur en base).
const text = html.replace(/ (href|aria-label)="[^"]*"/g, "").replace(/<[^>]+>/g, " ")

describe("HomeCatalog", () => {
  it("porte l'ancre services", () => {
    expect(html).toContain('<section class="section" id="services">')
  })

  it("rend une carte par valeur de MISSION_TYPES, « Autre besoin » en dernier", () => {
    expect(cards).toHaveLength(MISSION_TYPES.length)
    expect(cards.at(-1).className).toContain("v-cat--wide")
    expect(cards.at(-1).href).toBe("/client/missions/new?type=Autre")
    const hrefs = cards.map((c) => decodeURIComponent(c.href.split("type=")[1]).replace(/\+/g, " "))
    expect([...hrefs].sort()).toEqual([...MISSION_TYPES].sort())
  })

  it("ouvre la publication avec le type encodé", () => {
    const cours = cards.find((c) => c.href.includes("Cours"))
    expect(cours.href).toBe("/client/missions/new?type=Cours+particuliers")
    const demarches = cards.find((c) => c.href.includes("type=D"))
    expect(demarches.href).toBe("/client/missions/new?type=D%C3%A9marches")
  })

  it("affiche les libellés exacts du dictionnaire dans l'ordre", () => {
    const names = cards.map((c) => c.body.match(/v-cat__name">([^<]*)</)[1].replace(/&#x27;/g, "'"))
    expect(names).toEqual([
      "Marché et achats",
      "Cours et aide aux devoirs",
      "Garde d'enfants",
      "Travaux sur ordinateur",
      "Réseaux sociaux",
      "Traduction",
      "Démarches et files d'attente",
      "Autre besoin",
    ])
    for (const type of MISSION_TYPES) {
      expect(names).toContain(missionTypeLabel(type).replace(/&#x27;/g, "'"))
    }
  })

  it("garde l'accroche du marché et des démarches", () => {
    expect(html).toContain("Le marché à votre place.")
    expect(html).toContain("La file d&#x27;attente à votre place.")
  })

  it("annonce le budget minimum", () => {
    expect(text).toMatch(/dès\s+2[\s  ]000 FCFA/)
  })

  it("n'emploie aucun mot banni et vouvoie", () => {
    expect(text).not.toMatch(/livraison|course|coursier|saisie|commission/i)
    expect(text).not.toMatch(/(?<![\p{L}])(ton|ta|tes|tu|toi)(?![\p{L}])/iu)
  })
})
