import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { ErrorState, isInternalPath } = await import("./state-block")

const html = (node) => renderToStaticMarkup(node)

describe("ErrorState : lien de sortie optionnel", () => {
  it("rend un vrai lien interne après le bouton Réessayer, aussi en compact", () => {
    for (const compact of [false, true]) {
      const out = html(<ErrorState compact={compact} action={{ href: "/client/messages", label: "Retour aux messages" }} />)
      expect(out).toContain('<a class="hero2__link" href="/client/messages">Retour aux messages</a>')
      expect(out.indexOf("Réessayer")).toBeLessThan(out.indexOf("Retour aux messages"))
      expect(out).not.toContain("style=")
    }
  })

  it("garde le lien avec onRetry", () => {
    const out = html(<ErrorState onRetry={() => {}} action={{ href: "/messages", label: "Retour" }} />)
    expect(out).toContain("Réessayer")
    expect(out).toContain('href="/messages"')
  })

  it("refuse une adresse externe, protocol-relative, un schéma ou un chemin relatif", () => {
    for (const href of ["https://exemple.com", "//exemple.com", "javascript:alert(1)", "messages", "/\\exemple.com", "", undefined]) {
      const out = html(<ErrorState action={{ href, label: "Sortie" }} />)
      expect(out).not.toContain("Sortie")
      expect(out).not.toContain("<a ")
    }
    expect(isInternalPath("/ok")).toBe(true)
    expect(isInternalPath("//x")).toBe(false)
  })

  it("sans action : rendu inchangé, aucun lien", () => {
    const out = html(<ErrorState title="T" text="X" />)
    expect(out).not.toContain("<a ")
    expect(out.endsWith("Réessayer</button></div>")).toBe(true)
  })
})
