import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("@/components/vitrine/vitrine-navbar", () => ({ VitrineNavbar: ({ audience }) => <nav data-audience={audience} /> }))
vi.mock("@/components/vitrine/vitrine-footer", () => ({ VitrineFooter: ({ audience }) => <footer data-audience={audience} /> }))

const { default: MissionsPublicLoading } = await import("./loading")

describe("MissionsPublicLoading", () => {
  it("pose l'en-tête et le pied de page du public etudiants", () => {
    const html = renderToStaticMarkup(<MissionsPublicLoading />)
    expect(html).toContain('<nav data-audience="etudiants">')
    expect(html).toContain('<footer data-audience="etudiants">')
  })
})
