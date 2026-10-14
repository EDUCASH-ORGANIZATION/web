import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

let actionState = null

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useActionState: (action) => [actionState, action, false] }
})
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/actions/password.actions", () => ({ requestPasswordReset: vi.fn() }))

const { ForgotPasswordForm } = await import("./forgot-password-form")

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

beforeEach(() => {
  actionState = null
})

describe("ForgotPasswordForm", () => {
  it("rend un formulaire à action serveur, bouton désactivé au SSR, jamais en GET", () => {
    const html = renderToStaticMarkup(<ForgotPasswordForm />)
    expect(html).not.toMatch(/method="get"/i)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/)
    expect(html).toContain('name="email"')
    expect(html).toContain("Mot de passe oublié ?")
  })

  it("vouvoie tous les publics, sans champ audience ni forme du tutoiement", () => {
    const html = renderToStaticMarkup(<ForgotPasswordForm />)
    expect(html).toContain("Saisissez l&#x27;adresse de votre compte")
    expect(html).toContain('placeholder="vous@exemple.bj"')
    expect(html).not.toContain('name="audience"')
    expect(text(html)).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu)
  })

  it("affiche l'erreur de format sous le champ", () => {
    actionState = { fieldErrors: { email: "Cette adresse email n'est pas valide." } }
    const html = renderToStaticMarkup(<ForgotPasswordForm />)
    expect(html).toContain("input is-error")
    expect(html).toContain("n&#x27;est pas valide")
  })

  it("affiche trop de demandes sans durée", () => {
    actionState = { code: "rate_limited", formError: "Trop de tentatives. Réessayez dans quelques minutes." }
    const html = renderToStaticMarkup(<ForgotPasswordForm />)
    expect(html).toContain("banner--alerte")
    expect(html).toContain("Trop de demandes")
  })

  it("affiche l'écran Email envoyé sans durée de validité, avec renvoi décompté", () => {
    actionState = { status: "sent" }
    const html = renderToStaticMarkup(<ForgotPasswordForm />)
    expect(html).toContain("Regardez votre boîte mail")
    expect(html).toContain("Renvoyer dans 1:00")
    expect(html).not.toMatch(/valable|\b\d+\s*h\b/)
    expect(html).not.toContain("<form")
  })
})
