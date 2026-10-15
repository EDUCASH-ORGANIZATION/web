import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))

const { MissionHeader } = await import("./mission-header")

const back = { href: "/student/missions", label: "Missions" }
const mission = (over) => ({
  title: "Cours de physique", type: "Livraison", city: "Cadjèhoun", deadline: "2099-10-30", createdAt: "2026-10-06T08:00:00Z",
  ...over,
})
const render = (m, props = {}) => renderToStaticMarkup(<MissionHeader mission={m} back={back} {...props} />)
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

describe("MissionHeader étudiant", () => {
  it("porte un seul h1, le type par son libellé et la date de publication (E03)", () => {
    const html = render(mission())
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("Marché et achats · Publiée le 6 octobre 2026")
    expect(html).not.toContain("Livraison")
  })

  it("n'affiche aucun badge de statut", () => {
    const html = render(mission({ purchasesEstimate: 5000 }))
    expect(html).not.toMatch(/badge--(neutre|bleu|succes|erreur|alerte)[^"]*"[^>]*>(Ouverte|En cours|Terminée)/)
    expect(html.match(/class="badge /g)).toHaveLength(1)
  })

  it("ordonne lieu, date, candidats, Avec achats dans .e2-03-meta", () => {
    const html = render(mission({ purchasesEstimate: 5000, applicationsCount: 2 }))
    const meta = html.slice(html.indexOf('class="e2-03-meta"'))
    const order = ["Cadjèhoun", "Avant le", "2 candidats", "Avec achats"].map((t) => meta.indexOf(t))
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(meta).toContain("badge--sm")
  })

  it("omet candidats et badge sans donnée, accorde le singulier", () => {
    const html = text(render(mission({ applicationsCount: 0 })))
    expect(html).not.toContain("candidat")
    expect(html).not.toContain("Avec achats")
    expect(text(render(mission({ applicationsCount: 1 })))).toContain("1 candidat")
    expect(text(render(mission({ applicationsCount: 1 })))).not.toContain("1 candidats")
  })

  it("E05 : « <type> · retenue le <date> » seulement si la date existe", () => {
    const withDate = render(mission(), { variant: "05", retainedAt: "2026-10-02T16:00:00Z" })
    expect(withDate).toContain("Marché et achats · retenue le 2 octobre 2026")
    expect(withDate).toContain('class="e2-05-meta"')
    const without = text(render(mission(), { variant: "05" }))
    expect(without).toContain("Marché et achats")
    expect(without).not.toContain("retenue")
    expect(without).not.toContain("Publiée")
  })
})
