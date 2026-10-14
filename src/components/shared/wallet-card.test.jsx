import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))

const { WalletCard } = await import("./wallet-card")

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ")

function render(props) {
  return renderToStaticMarkup(<WalletCard balance={20000} reserved={5000} available={15000} showActions {...props} />)
}

describe("WalletCard, paiements coupés (défaut)", () => {
  it("client : aucun bouton de recharge ni de retrait, message vouvoyé", () => {
    const html = render({ role: "client" })
    expect(html).not.toMatch(/<button/)
    expect(text(html)).not.toMatch(/Recharger|Retirer/)
    expect(text(html)).toContain("Recharge et retrait en cours d'activation")
    expect(text(html)).toMatch(/Vos fonds/)
    expect(text(html)).not.toMatch(/(?<![\p{L}])(ton|ta|tes|tu|toi)(?![\p{L}])/iu)
  })

  it("étudiant : aucun bouton de retrait, message vouvoyé", () => {
    const html = render({ role: "student" })
    expect(html).not.toMatch(/<button/)
    expect(text(html)).not.toContain("Retirer mes gains")
    expect(text(html)).toContain("Recharge et retrait en cours d'activation")
    expect(text(html)).toMatch(/Vos gains/)
    expect(text(html)).not.toMatch(/(?<![\p{L}])(ton|ta|tes|tu|toi)(?![\p{L}])/iu)
  })

  it("garde le solde et le lien vers l'historique", () => {
    const html = render({ role: "client" })
    expect(text(html)).toContain("15 000")
    expect(html).toContain('href="/client/wallet"')
  })

  it("sans actions demandées, n'affiche aucun message", () => {
    expect(text(render({ role: "student", showActions: false }))).not.toContain("en cours d'activation")
  })
})

describe("WalletCard, paiements ouverts", () => {
  it("client : boutons Recharger et Retirer", () => {
    const html = render({ role: "client", paymentsEnabled: true })
    expect(text(html)).toContain("Recharger")
    expect(text(html)).toContain("Retirer")
    expect(text(html)).not.toContain("en cours d'activation")
  })

  it("étudiant : bouton Retirer mes gains", () => {
    const html = render({ role: "student", paymentsEnabled: true })
    expect(text(html)).toContain("Retirer mes gains")
    expect(text(html)).not.toContain("en cours d'activation")
  })
})
