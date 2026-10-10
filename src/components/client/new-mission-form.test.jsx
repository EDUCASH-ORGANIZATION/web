import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/actions/mission.actions", () => ({ createMission: vi.fn() }))
vi.mock("@/components/shared/toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }))

const { NewMissionForm } = await import("./new-mission-form")

describe("NewMissionForm", () => {
  it("les options affichent le libellé et gardent la valeur en base", () => {
    const html = renderToStaticMarkup(<NewMissionForm profile={null} walletAvailable={5000} />)
    expect(html).toContain('<option value="Livraison">Marché et achats</option>')
    expect(html).toContain('<option value="Démarches">Démarches et files d&#x27;attente</option>')
    expect(html).toContain('<option value="Saisie">Travaux sur ordinateur</option>')
    expect(html).not.toContain(">Livraison</option>")
  })

  it("initialise titre, type et ville depuis initial", () => {
    const html = renderToStaticMarkup(
      <NewMissionForm
        profile={null}
        walletAvailable={5000}
        initial={{ title: "Faire le marché", type: "Livraison", city: "Porto-Novo" }}
      />,
    )
    expect(html).toContain('value="Faire le marché"')
    expect(html).toContain('<option value="Livraison" selected="">Marché et achats</option>')
    expect(html).toContain('<option value="Porto-Novo" selected="">Porto-Novo</option>')
  })

  it("l'aperçu affiche le libellé du type", () => {
    const html = renderToStaticMarkup(
      <NewMissionForm profile={null} walletAvailable={5000} initial={{ title: "", type: "Livraison", city: "" }} />,
    )
    expect(html).toMatch(/uppercase tracking-wide[^>]*>Marché et achats<\/span>/)
  })
})
