import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))

const { MissionHeader } = await import("./mission-header")

const mission = (over) => ({
  id: "m1", title: "Cours de maths", type: "Livraison", city: "Cotonou", budget: 10000, deadline: "2099-12-31",
  status: "open", ...over,
})
const render = (m, status = { label: "Ouverte", tone: "neutre" }) =>
  renderToStaticMarkup(<MissionHeader mission={m} status={status} />)
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ")

describe("MissionHeader client", () => {
  it("porte un seul h1 et aucun fil d'Ariane", () => {
    const html = render(mission())
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).not.toContain("Fil d&#x27;Ariane")
    expect(html).not.toContain("<nav")
  })

  it.each([
    ["open", "Mes missions · Ouvertes", "/client/missions"],
    ["in_progress", "Mes missions · En cours", "/client/missions?onglet=in_progress"],
    ["done", "Mes missions · Terminées", "/client/missions?onglet=done"],
    ["cancelled", "Mes missions · Annulées", "/client/missions?onglet=cancelled"],
  ])("la ligne de date de %s renvoie vers son onglet", (status, label, href) => {
    const html = render(mission({ status }))
    expect(html).toContain(`<div class="head2__date"><a href="${href}">${label}</a></div>`)
  })

  it("la méta ne porte plus le séquestre ; la ligne d'achats est provisoirement sous la méta", () => {
    const html = render(mission({ purchasesEstimate: 7450 }))
    const meta = html.slice(html.indexOf('<div class="meta2">'))
    const metaOnly = text(meta.slice(0, meta.indexOf("</div>")))
    expect(metaOnly).not.toContain("séquestre")
    expect(metaOnly).not.toContain("Achats estimés")
    expect(text(html)).toContain("Achats estimés : environ")
    expect(html.indexOf("Achats estimés")).toBeGreaterThan(html.indexOf("Avec achats"))
  })

  it("sans estimation, aucune ligne d'achats", () => {
    expect(render(mission({ purchasesEstimate: null }))).not.toContain("Achats estimés")
  })

  it.each(["in_progress", "done", "cancelled"])("%s : le type par son libellé après la date, jamais la valeur brute", (status) => {
    const html = render(mission({ status }))
    const meta = html.slice(html.indexOf('<div class="meta2">'))
    expect(meta.indexOf("Marché et achats")).toBeGreaterThan(meta.indexOf("#i-calendar"))
    expect(html).not.toContain("Livraison")
  })

  it("open : pas de type dans la méta", () => {
    expect(render(mission({ status: "open" }))).not.toContain("Marché et achats")
  })

  it("open : Urgent juste après le statut, puis lieu, date, Publiée le", () => {
    const html = render(mission({ urgency: "high", createdAt: "2026-10-06T08:00:00Z" }))
    const meta = html.slice(html.indexOf('<div class="meta2">'))
    const order = ["Ouverte", "Urgent", "Cotonou", "Avant le", "Publiée le 6 octobre 2026"].map((t) => meta.indexOf(t))
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(meta).toContain("#i-zap")
    expect(meta).toContain("#i-clock")
  })

  it("pas d'Urgent hors urgence haute, pas de Publiée le sans createdAt, ni hors open", () => {
    expect(render(mission({ urgency: "low" }))).not.toContain("Urgent")
    expect(render(mission())).not.toContain("Publiée le")
    expect(render(mission({ status: "done", urgency: "high", createdAt: "2026-10-06T08:00:00Z" }))).not.toContain("Publiée le")
  })

  it.each([
    ["open", "Avant le 31 décembre 2099"],
    ["in_progress", "Jusqu'au 31 décembre 2099"],
    ["done", "31 décembre 2099"],
    ["cancelled", "31 décembre 2099"],
  ])("%s : préfixe de date", (status, expected) => {
    const out = text(render(mission({ status })))
    expect(out).toContain(expected)
    if (status === "done" || status === "cancelled") {
      expect(out).not.toContain("Avant le")
      expect(out).not.toContain("Jusqu")
    }
  })

  it("ordonne statut, Avec achats, lieu, date dans .meta2 avec badges badge--sm", () => {
    const html = render(mission({ status: "in_progress", purchasesEstimate: 7450 }), { label: "En cours", tone: "bleu" })
    const meta = html.slice(html.indexOf('<div class="meta2">'))
    const order = ["En cours", "Avec achats", "Cotonou", "Jusqu", "Marché et achats"].map((t) => meta.indexOf(t))
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(meta).toContain('class="badge badge--bleu badge--sm"')
    expect(meta).toContain('class="badge badge--neutre badge--sm"')
    expect(meta).toContain("#i-receipt")
  })

  it("sans estimation, le badge « Avec achats » est absent", () => {
    for (const purchasesEstimate of [undefined, null, 0]) {
      expect(render(mission({ purchasesEstimate }))).not.toContain("Avec achats")
    }
  })

})

// Cas limites complémentaires (RD-FIDELITE-01 ST-03, tester) : estimation décimale ou en chaîne.
describe("badge « Avec achats » : estimations décimales", () => {
  it.each([[1500.75], ["1500.75"], [0.5], ["2500.00"]])("présent pour %s (arrondi positif)", (purchasesEstimate) => {
    expect(render(mission({ purchasesEstimate }))).toContain("Avec achats")
  })

  it.each([[0.4], ["0.2"], [0], [-1.5], ["abc"], [NaN], [true], [1e12]])("absent pour %s", (purchasesEstimate) => {
    expect(render(mission({ purchasesEstimate }))).not.toContain("Avec achats")
  })

  it("un seul badge « Avec achats » même avec une estimation décimale", () => {
    const html = render(mission({ purchasesEstimate: 1500.75 }))
    expect(html.match(/Avec achats/g)).toHaveLength(1)
  })
})
