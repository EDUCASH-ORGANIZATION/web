import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/components/app-ui/toast", () => ({ useAppToast: () => ({ success: vi.fn() }) }))
vi.mock("@/lib/actions/admin-verifications.actions", () => ({
  approveStudentCard: vi.fn(),
  rejectStudentCard: vi.fn(),
  resetStudentRejection: vi.fn(),
  revokeStudentBadge: vi.fn(),
}))

const { DossierPanel } = await import("./dossier-panel")

const hrefs = { prev: null, next: null, afterDecision: "/admin/verifications", self: "/admin/verifications", list: "/admin/verifications" }
const dossier = (over = {}) => ({
  userId: "11111111-1111-4111-8111-111111111111",
  name: "Codjo Ahouansou",
  school: "EPAC",
  level: "Licence 3",
  tab: "a-examiner",
  actions: ["approve", "reject"],
  cardView: { kind: "image", url: "https://storage.example/c.jpg" },
  today: "2026-10-15",
  ...over,
})
const render = (over) => renderToStaticMarkup(<DossierPanel dossier={dossier(over)} hrefs={hrefs} badgeUntil="2027-10-15" />)
const labels = (html) => [...html.matchAll(/<button[^>]*class="btn [^"]*"[^>]*>(.*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""))

describe("DossierPanel : décisions", () => {
  it("Refuser avant Valider, au bureau et dans la barre mobile", () => {
    expect(labels(render())).toEqual(["RefuserR", "ValiderV", "Refuser", "Valider"])
  })

  it("une seule action principale bleue", () => {
    expect(render().match(/a2-02-cta/g)).toHaveLength(2)
  })

  it("bascule du dossier suivant : seulement quand Valider est possible", () => {
    expect(render()).toContain("Passer au dossier suivant après décision")
    expect(render({ tab: "refuses", actions: ["reset"] })).not.toContain("Passer au dossier suivant")
    expect(render({ tab: "verifies", actions: ["revoke"] })).not.toContain("Passer au dossier suivant")
  })

  it("Réinitialiser en bouton secondaire « Réinitialiser le dossier »", () => {
    const html = render({ tab: "refuses", actions: ["reset"], rejectionReason: "Photo floue" })
    expect(html).toContain('class="btn btn--secondary"')
    expect(html).toContain("Réinitialiser le dossier")
    expect(html).not.toContain("btn--dark")
  })

  it("pastille +48 h mobile seulement si le délai est dépassé", () => {
    expect(render({ overdue48h: true })).toContain('<span class="badge badge--erreur badge--sm">+48 h</span>')
    expect(render({ overdue48h: false })).not.toContain("+48 h")
  })

  it("« Ouvrir la fiche » reste rendu hors bloc bureau : seul chemin vers la fiche sur tablette et mobile", () => {
    for (const over of [{}, { tab: "refuses", actions: ["reset"] }, { tab: "verifies", actions: ["revoke"] }, { tab: "incomplets", actions: [] }]) {
      const html = render(over)
      const status = html.slice(html.indexOf('class="a2-02-dossier__status"'))
      expect(status).toMatch(/^class="a2-02-dossier__status">.*<a class="link body-s" href="\/admin\/users\/11111111-1111-4111-8111-111111111111">Ouvrir la fiche<\/a>/)
      expect(html).not.toMatch(/ds-desk-only[^>]*>[^<]*<a class="link body-s"/)
    }
  })

  it("aucune note grise d'attente sans décision", () => {
    expect(render({ tab: "incomplets", actions: [], cardView: null })).not.toContain("En attente d")
  })
})
