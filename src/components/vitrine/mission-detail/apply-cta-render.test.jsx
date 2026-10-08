import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const { ApplyPanel } = await import("./apply-panel")
const { ApplyBar } = await import("./apply-bar")
const { applyCta } = await import("@/lib/vitrine/apply-cta")

const ID = "11111111-1111-4111-8111-111111111111"
const NEXT = "/auth/login?next=%2Fstudent%2Fmissions%2F" + ID

describe("ApplyPanel et ApplyBar", () => {
  const visitor = applyCta({ role: null, missionId: ID, missionType: "Saisie", accepting: true })

  it("visiteur : même lien de connexion dans la colonne et dans la barre", () => {
    expect(renderToStaticMarkup(<ApplyPanel cta={visitor} />)).toContain(`href="${NEXT}"`)
    expect(renderToStaticMarkup(<ApplyBar cta={visitor} budget={5000} />)).toContain(`href="${NEXT}"`)
  })

  it("étudiant non vérifié : indication et lien Postuler conservé", () => {
    const cta = applyCta({ role: "student", missionId: ID, missionType: "Saisie", accepting: true })
    for (const html of [
      renderToStaticMarkup(<ApplyPanel cta={cta} needsVerification />),
      renderToStaticMarkup(<ApplyBar cta={cta} budget={5000} needsVerification />),
    ]) {
      expect(html).toContain('href="/profile/verify"')
      expect(html).toContain(`href="/student/missions/${ID}"`)
    }
  })

  it("client : message affiché et lien de publication", () => {
    const cta = applyCta({ role: "client", missionId: ID, missionType: "Saisie", accepting: true })
    const html = renderToStaticMarkup(<ApplyPanel cta={cta} />)
    expect(html).toContain("réservées aux étudiants")
    expect(html).toContain('href="/client/missions/new"')
  })

  it("mission fermée : aucun lien de candidature", () => {
    const cta = applyCta({ role: "student", missionId: ID, missionType: "Saisie", accepting: false })
    const html = renderToStaticMarkup(<ApplyBar cta={cta} budget={5000} caption="Échéance dépassée" />)
    expect(html).not.toContain(`/student/missions/${ID}`)
    expect(html).toContain("/missions?type=Saisie")
  })
})
