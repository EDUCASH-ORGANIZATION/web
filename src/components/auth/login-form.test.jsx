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
vi.mock("@/lib/actions/auth.actions", () => ({ login: vi.fn() }))
vi.mock("@/lib/actions/email-confirmation.actions", () => ({ resendSignupConfirmation: vi.fn() }))

const { LoginForm } = await import("./login-form")

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

beforeEach(() => {
  actionState = null
})

describe("LoginForm", () => {
  it("ne peut jamais partir en GET : action serveur, bouton désactivé au SSR", () => {
    const html = renderToStaticMarkup(<LoginForm />)
    expect(html).toContain("<form")
    expect(html).not.toMatch(/method="get"/i)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/)
    expect(html).toContain('name="email"')
    expect(html).toContain('name="password"')
    expect(html).toContain('type="password"')
  })

  it("mène vers la réinitialisation sans toast et sans MUI", () => {
    const html = renderToStaticMarkup(<LoginForm forgotHref="/auth/forgot-password?role=student" />)
    expect(html).toContain('href="/auth/forgot-password?role=student"')
    expect(html).not.toContain("bientôt")
    expect(html).not.toContain("Mui")
    expect(html).not.toContain("style=")
  })

  it("vouvoie par défaut (public inconnu) sans champ audience", () => {
    const html = renderToStaticMarkup(<LoginForm />)
    expect(html).toContain("Content de vous revoir")
    expect(text(html)).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
    expect(html).not.toContain('name="audience"')
    expect(html).not.toContain('name="next"')
    expect(html).toContain('href="/auth/register"')
  })

  it("tutoie l'étudiant connu, avec le champ caché audience=student", () => {
    const html = renderToStaticMarkup(<LoginForm role="student" next="/dashboard" />)
    expect(html).toContain("Content de te revoir")
    expect(html).toContain('type="hidden" name="audience" value="student"')
    expect(html).toContain('type="hidden" name="next" value="/dashboard"')
    expect(html).toContain('href="/auth/register?role=student&amp;next=%2Fdashboard"')
    expect(html).toContain("Tu reviens juste après")
  })

  it("vouvoie le client et conserve next (champ caché et lien d'inscription)", () => {
    const next = "/client/missions/new?besoin=Cours&ville=Cotonou"
    const html = renderToStaticMarkup(<LoginForm role="client" next={next} />)
    expect(html).toContain("Content de vous revoir")
    expect(html).toContain(`name="next" value="${next.replace(/&/g, "&amp;")}"`)
    expect(html).toContain("role=client")
    expect(html).not.toContain('name="audience"')
    expect(text(html)).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
  })

  it("affiche les erreurs de champ sous les champs", () => {
    actionState = { fieldErrors: { email: "Saisissez votre adresse email.", password: "Saisissez votre mot de passe." } }
    const html = renderToStaticMarkup(<LoginForm />)
    expect(html).toContain("Saisissez votre adresse email.")
    expect(html).toContain("Saisissez votre mot de passe.")
    expect(html).toContain("input is-error")
    expect(html).toContain("control is-error")
  })

  it("affiche la bannière d'erreur d'identifiants", () => {
    actionState = { code: "invalid_credentials", formError: "Email ou mot de passe incorrect." }
    const html = renderToStaticMarkup(<LoginForm />)
    expect(html).toContain("banner--erreur")
    expect(html).toContain("Email ou mot de passe incorrect.")
  })

  it("propose le renvoi de l'email de confirmation avec compte à rebours", () => {
    actionState = { code: "email_not_confirmed", formError: "Votre adresse email n'est pas encore confirmée." }
    const html = renderToStaticMarkup(<LoginForm />)
    expect(html).toContain("banner--alerte")
    expect(html).toContain("Renvoyer l&#x27;email de confirmation")
  })

  it("gère trop de tentatives, session expirée, réseau et compte suspendu", () => {
    actionState = { code: "rate_limited", formError: "Trop de tentatives. Réessayez dans quelques minutes." }
    expect(renderToStaticMarkup(<LoginForm />)).toContain("Trop de tentatives")
    actionState = { code: "session_expired", formError: "Votre session a expiré. Reconnectez-vous." }
    expect(renderToStaticMarkup(<LoginForm />)).toContain("banner--info")
    actionState = { code: "network", formError: "Problème de connexion." }
    expect(renderToStaticMarkup(<LoginForm />)).toContain("Problème de connexion.")
    actionState = { code: "suspended", formError: "Votre compte est suspendu.", contactHref: "/contact" }
    const suspended = renderToStaticMarkup(<LoginForm />)
    expect(suspended).toContain('href="/contact"')
    expect(suspended).not.toMatch(/\b\d+\s*h\b/)
  })

  it("affiche la bannière de compte suspendu venant de la confirmation d'un lien", () => {
    const html = renderToStaticMarkup(<LoginForm suspended />)
    expect(html).toContain("Compte suspendu")
    expect(html).toContain('href="/contact"')
  })
})
