import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup as renderRaw } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, replace, scroll, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/actions/auth.actions", () => ({ register: vi.fn() }))

const { RegisterForm, REGISTER_COPY } = await import("./register-form")
const { default: RegisterPage } = await import("@/app/auth/register/page")

// Rend le HTML et décode les entités courantes pour comparer des textes lisibles.
const renderToStaticMarkup = (element) => renderRaw(element).replace(/&amp;/g, "&").replace(/&#x27;/g, "'")
// Formes du tutoiement (les accents ne sont pas des limites de mot en JavaScript, d'où les lookarounds).
const TU_FORMS = /(?<!\p{L})(tu|ton|ta|tes|toi|connecte-toi)(?!\p{L})/iu
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

async function renderPage(query) {
  return renderToStaticMarkup(await RegisterPage({ searchParams: Promise.resolve(query) }))
}

const NEXT = "/client/missions/new?besoin=Repas&ville=Cotonou"

describe("RegisterForm", () => {
  it("n'a ni method get ni envoi natif possible avant hydratation", () => {
    const html = renderToStaticMarkup(<RegisterForm />)
    expect(html).not.toMatch(/method="get"/i)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
    expect(html).toContain("Créer mon compte")
  })

  it("sans rôle : aucune carte cochée, champ rôle vide, ton étudiant par défaut", () => {
    const html = renderToStaticMarkup(<RegisterForm />)
    expect(html).not.toContain("is-selected")
    expect(html).toContain('name="role" value=""')
    expect(html).toContain("Crée ton compte")
    expect(html).not.toContain('name="next"')
  })

  it("rôle étudiant : carte cochée, tutoiement, champ audience", () => {
    const html = renderToStaticMarkup(<RegisterForm role="student" audience="student" />)
    expect(html.match(/is-selected/g)).toHaveLength(1)
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('name="audience" value="student"')
    expect(html).toContain('name="role" value="student"')
    const body = text(html)
    expect(body).toContain("Confirme ton mot de passe")
    expect(body).not.toMatch(/\bvous\b|\bvotre\b/i)
  })

  it("rôle client : vouvoiement, next conservé en champ caché", () => {
    const html = renderToStaticMarkup(<RegisterForm role="client" audience="client" next={NEXT} />)
    const body = text(html)
    expect(body).toContain("Créez votre compte")
    expect(body).toContain("Confirmez le mot de passe")
    expect(body).not.toMatch(TU_FORMS)
    expect(html).toContain(`name="next" value="${NEXT}"`)
    expect(html).toContain('name="role" value="client"')
  })

  it("les cartes de rôle sont des liens ?role= qui gardent next (sans JavaScript)", () => {
    const html = renderToStaticMarkup(<RegisterForm role="student" next={NEXT} />)
    expect(html).toContain(`href="/auth/register?role=student&next=${encodeURIComponent(NEXT)}"`)
    expect(html).toContain(`href="/auth/register?role=client&next=${encodeURIComponent(NEXT)}"`)
  })

  it("rend la checklist, la case CGU avec ses liens et le lien de connexion", () => {
    const html = renderToStaticMarkup(<RegisterForm role="student" next={NEXT} />)
    expect(html.match(/<li/g)).toHaveLength(5)
    expect(html).toContain('href="/legal/terms"')
    expect(html).toContain('href="/legal/privacy"')
    expect(html).toContain('name="cgu"')
    expect(html).toContain(`href="/auth/login?next=${encodeURIComponent(NEXT)}"`)
  })

  it("ne contient ni durée de validité ni style en ligne", () => {
    for (const audience of ["student", "client"]) {
      const html = renderToStaticMarkup(<RegisterForm role={audience} audience={audience} />)
      expect(text(html)).not.toMatch(/24 ?h/)
      expect(html).not.toContain("style=")
    }
    expect(JSON.stringify(REGISTER_COPY)).not.toContain("\u2014")
  })
})

describe("page /auth/register", () => {
  it("role=client + next : carte client cochée, panneau encre, vouvoiement, next intact", async () => {
    const html = await renderPage({ role: "client", next: NEXT })
    expect(html).toContain("auth__brand--client")
    expect(html).toContain("Créez votre compte")
    expect(html).toContain(`name="next" value="${NEXT}"`)
    expect(html.match(/is-selected/g)).toHaveLength(1)
    expect(html).toMatch(/is-selected[^>]*>(?:(?!<\/div>).)*Je publie des missions/)
  })

  it("role=admin est ignoré : aucune carte présélectionnée", async () => {
    const html = await renderPage({ role: "admin" })
    expect(html).not.toContain("is-selected")
    expect(html).toContain('name="role" value=""')
    expect(html).not.toContain("auth__brand--client")
  })

  it("accepte l'alias redirect et ignore un next dangereux", async () => {
    const withAlias = await renderPage({ role: "student", redirect: "/missions/42" })
    expect(withAlias).toContain('name="next" value="/missions/42"')
    const forged = await renderPage({ role: "student", next: "//evil.example" })
    expect(forged).not.toContain('name="next"')
  })

  it("next sous /client sans rôle : panneau client", async () => {
    const html = await renderPage({ next: NEXT })
    expect(html).toContain("auth__brand--client")
  })

  it("n'affiche plus l'ancien message d'erreur ni de réinscription", async () => {
    const html = await renderPage({ error: "lien_invalide_ou_expire" })
    expect(text(html)).not.toMatch(/réinscris|24 ?h/i)
    expect(html).not.toContain('role="alert"')
  })
})
