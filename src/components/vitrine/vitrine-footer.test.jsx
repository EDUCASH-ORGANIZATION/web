import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { COMMISSION_RATE } from "@/lib/constants/missions"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/navigation", () => ({ usePathname: () => "/" }))

const { VitrineFooter } = await import("./vitrine-footer")

const html = renderToStaticMarkup(<VitrineFooter />)
const percent = Math.round(COMMISSION_RATE * 100)

describe("VitrineFooter", () => {
  it("pose les quatre colonnes", () => {
    for (const title of ["Familles et entreprises", "Étudiants", "EduCash", "Légal"]) {
      expect(html).toContain(`>${title}</h2>`)
    }
  })

  it("lie /etudiants et les sections de l'accueil, jamais /clients", () => {
    expect(html).toContain('href="/etudiants"')
    expect(html).toContain('href="/#etapes"')
    expect(html).toContain('href="/#services"')
    expect(html).not.toContain('href="/clients"')
    expect(html).not.toContain("Entreprises<")
    expect(html).not.toContain("Pour les clients")
  })

  it("affiche MTN, Moov et Celtiis sans nommer le prestataire", () => {
    expect(html).toContain("MTN MoMo")
    expect(html).toContain("Moov Money")
    expect(html).toContain("Celtiis Cash")
    expect(html).not.toMatch(/fedapay|payer--fedapay/i)
  })

  it("calcule la commission depuis COMMISSION_RATE", () => {
    expect(html).toContain(`Commission unique de ${percent} %, incluse dans le budget`)
  })

  it("nomme l'éditeur BRANDYBEN", () => {
    expect(html).toContain("© 2026 EduCash, édité par BRANDYBEN · Cotonou, Bénin")
  })

  it("change l'accroche selon le public", () => {
    expect(html).toContain("Déléguez.")
    expect(html).toContain("Respirez.")
    const students = renderToStaticMarkup(<VitrineFooter audience="etudiants" />)
    expect(students).toContain("Du vrai cash.")
    expect(students).not.toContain("Respirez.")
  })
})
