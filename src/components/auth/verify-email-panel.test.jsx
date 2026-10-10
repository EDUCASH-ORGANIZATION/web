import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup as renderRaw } from "react-dom/server"

const cookieValue = vi.hoisted(() => ({ current: undefined }))

vi.mock("next/link", () => ({
  default: ({ href, children, replace, scroll, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue.current ? { value: cookieValue.current } : undefined) }),
}))
vi.mock("@/lib/actions/email-confirmation.actions", () => ({ resendSignupConfirmation: vi.fn() }))

const { VerifyEmailPanel, VERIFY_COPY } = await import("./verify-email-panel")
const { default: VerifyEmailPage } = await import("@/app/auth/verify-email/page")

// Rend le HTML et décode les entités courantes pour comparer des textes lisibles.
const renderToStaticMarkup = (element) => renderRaw(element).replace(/&amp;/g, "&").replace(/&#x27;/g, "'")
// Formes du tutoiement (les accents ne sont pas des limites de mot en JavaScript, d'où les lookarounds).
const TU_FORMS = /(?<!\p{L})(tu|ton|ta|tes|toi|connecte-toi)(?!\p{L})/iu
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
const NEXT = "/client/missions/new?besoin=Repas&ville=Cotonou"

describe("VerifyEmailPanel", () => {
  it("avec adresse : la rappelle, propose la messagerie et un renvoi sans champ email", () => {
    const html = renderToStaticMarkup(<VerifyEmailPanel email="sena@gmail.com" audience="student" role="student" />)
    const body = text(html)
    expect(body).toContain("Vérifie ta boîte mail")
    expect(body).toContain("sena@gmail.com")
    expect(html).toContain("https://mail.google.com/")
    expect(body).toContain("Renvoyer l'email")
    expect(html).not.toContain('type="email"')
    expect(html).toContain('href="/auth/register?role=student"')
    expect(body).toContain("Connecte-toi ici")
  })

  it("sans adresse : version avec champ email, envoi par action (pas de GET)", () => {
    const html = renderToStaticMarkup(<VerifyEmailPanel audience="student" role="student" />)
    expect(html).toContain('type="email"')
    expect(html).toContain('name="email"')
    expect(html).not.toMatch(/method="get"/i)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
    expect(html).not.toContain("mail.google.com")
    expect(text(html)).toContain("à ton adresse email")
  })

  it("le compte à rebours est un bouton désactivé par défaut seulement après un clic", () => {
    const html = renderToStaticMarkup(<VerifyEmailPanel email="a@exemple.bj" audience="client" />)
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Renvoyer l'email<\/button>/)
    expect(html).not.toContain("Renvoyer dans")
  })

  it("client : vouvoiement et liens de reprise conservent role et next", () => {
    const html = renderToStaticMarkup(<VerifyEmailPanel email="a@exemple.bj" audience="client" role="client" next={NEXT} />)
    const body = text(html)
    expect(body).toContain("Vérifiez votre boîte mail")
    expect(body).toContain("Connectez-vous ici")
    expect(body).not.toMatch(TU_FORMS)
    expect(html).toContain(`href="/auth/register?role=client&next=${encodeURIComponent(NEXT)}"`)
    expect(html).toContain(`href="/auth/login?next=${encodeURIComponent(NEXT)}"`)
  })

  it("n'affiche aucune durée de validité et n'a aucun style en ligne", () => {
    for (const email of ["a@exemple.bj", null]) {
      const html = renderToStaticMarkup(<VerifyEmailPanel email={email} audience="student" />)
      expect(text(html)).not.toMatch(/24 ?h|valable/i)
      expect(html).not.toContain("style=")
    }
    expect(JSON.stringify(VERIFY_COPY)).not.toContain("\u2014")
  })
})

describe("page /auth/verify-email", () => {
  it("lit l'adresse dans le cookie, jamais dans l'URL", async () => {
    cookieValue.current = "rosine@exemple.bj"
    const element = await VerifyEmailPage({ searchParams: Promise.resolve({ role: "client", next: NEXT, email: "pirate@exemple.bj" }) })
    const html = renderToStaticMarkup(element)
    expect(html).toContain("rosine@exemple.bj")
    expect(html).not.toContain("pirate@exemple.bj")
    expect(html).toContain("auth__brand--client")
    expect(html).not.toMatch(/href="[^"]*(rosine|@)[^"]*"/)
  })

  it("sans cookie : version sans adresse", async () => {
    cookieValue.current = undefined
    const html = renderToStaticMarkup(await VerifyEmailPage({ searchParams: Promise.resolve({ role: "student" }) }))
    expect(html).toContain('name="email"')
    expect(html).not.toContain("auth__brand--client")
  })
})
