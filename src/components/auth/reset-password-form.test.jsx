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
vi.mock("@/lib/actions/password.actions", () => ({ updatePassword: vi.fn() }))

const { ResetPasswordForm, ResetLinkExpired } = await import("./reset-password-form")

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

beforeEach(() => {
  actionState = null
})

describe("ResetPasswordForm", () => {
  it("rend le formulaire à action serveur avec la checklist, jamais en GET", () => {
    const html = renderToStaticMarkup(<ResetPasswordForm email="sena@exemple.bj" />)
    expect(html).not.toMatch(/method="get"/i)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/)
    expect(html).toContain('name="password"')
    expect(html).toContain('name="confirmPassword"')
    expect(html).toContain("checklist")
    expect(html).toContain("8 caractères")
    expect(html).toContain("Pour le compte sena@exemple.bj.")
    expect(text(html)).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
  })

  it("affiche les erreurs sous les champs et marque les règles en erreur", () => {
    actionState = { fieldErrors: { password: "Votre mot de passe ne respecte pas toutes les règles.", confirmPassword: "Les mots de passe ne correspondent pas." } }
    const html = renderToStaticMarkup(<ResetPasswordForm />)
    expect(html).toContain("ne respecte pas toutes les règles")
    expect(html).toContain("ne correspondent pas")
    expect(html).toContain("is-ko")
  })

  it("affiche l'erreur serveur (même mot de passe)", () => {
    actionState = { code: "same_password", formError: "Choisissez un mot de passe différent de l'ancien." }
    expect(renderToStaticMarkup(<ResetPasswordForm />)).toContain("banner--erreur")
  })

  it("affiche le succès avec le lien de connexion", () => {
    actionState = { status: "updated" }
    const html = renderToStaticMarkup(<ResetPasswordForm />)
    expect(html).toContain("Mot de passe modifié")
    expect(html).toContain('href="/auth/login"')
    expect(html).toContain("Me connecter")
    expect(html).not.toContain("<form")
  })

  it("affiche l'état lien expiré vers la demande de lien, sans durée", () => {
    const expired = renderToStaticMarkup(<ResetLinkExpired />)
    expect(expired).toContain("Ce lien a expiré")
    expect(expired).toContain('href="/auth/forgot-password"')
    expect(expired).not.toMatch(/\b\d+\s*h\b/)
    actionState = { code: "expired", formError: "Votre session a expiré." }
    expect(renderToStaticMarkup(<ResetPasswordForm />)).toContain("Demander un nouveau lien")
  })
})
