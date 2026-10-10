import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup as renderRaw } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, replace, scroll, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/actions/email-confirmation.actions", () => ({ resendSignupConfirmation: vi.fn() }))

const { LinkExpiredForm, LINK_EXPIRED_COPY, LINK_CAUSES } = await import("./link-expired-form")
const { default: LinkExpiredPage } = await import("@/app/auth/link-expired/page")

// Rend le HTML et décode les entités courantes pour comparer des textes lisibles.
const renderToStaticMarkup = (element) => renderRaw(element).replace(/&amp;/g, "&").replace(/&#x27;/g, "'")
// Formes du tutoiement (les accents ne sont pas des limites de mot en JavaScript, d'où les lookarounds).
const TU_FORMS = /(?<!\p{L})(tu|ton|ta|tes|toi|connecte-toi)(?!\p{L})/iu
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

describe("LinkExpiredForm", () => {
  it("expire : formulaire de nouveau lien en premier, connexion en secondaire", () => {
    const html = renderToStaticMarkup(<LinkExpiredForm cause="expire" audience="student" />)
    const body = text(html)
    expect(body).toContain("Ce lien a expiré")
    expect(body).toContain("Recevoir un nouveau lien")
    expect(body).toContain("Ton adresse est déjà confirmée ?")
    expect(html.indexOf("Recevoir un nouveau lien")).toBeLessThan(html.indexOf("Me connecter"))
    expect(html).toContain('name="email"')
    expect(html).toContain('href="/auth/login"')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
    expect(html).not.toMatch(/method="get"/i)
  })

  it("utilise : la connexion devient l'action principale", () => {
    const html = renderToStaticMarkup(<LinkExpiredForm cause="utilise" audience="student" />)
    expect(text(html)).toContain("Ce lien a déjà servi")
    expect(html.indexOf("Me connecter")).toBeLessThan(html.indexOf("Recevoir un nouveau lien"))
    expect(html).toContain("btn btn--primary btn--lg btn--block")
  })

  it("autre-appareil : explique le changement d'appareil", () => {
    const html = renderToStaticMarkup(<LinkExpiredForm cause="autre-appareil" audience="client" />)
    expect(text(html)).toContain("Lien ouvert sur un autre appareil")
    expect(text(html)).toContain("connectez-vous ici")
    expect(html.indexOf("Me connecter")).toBeLessThan(html.indexOf("Recevoir un nouveau lien"))
  })

  it("invalide et cause inconnue : même écran générique", () => {
    for (const cause of ["invalide", "n-importe-quoi", undefined]) {
      const html = renderToStaticMarkup(<LinkExpiredForm cause={cause} audience="client" />)
      expect(text(html)).toContain("Ce lien n'est pas valide")
    }
  })

  it("flow recovery : oriente vers Mot de passe oublié, sans formulaire d'email", () => {
    for (const cause of LINK_CAUSES) {
      const html = renderToStaticMarkup(<LinkExpiredForm cause={cause} flow="recovery" audience="client" />)
      expect(html).toContain('href="/auth/forgot-password"')
      expect(html).not.toContain('name="email"')
      expect(text(html)).toContain("mot de passe")
    }
  })

  it("garde next dans le lien de connexion et le champ caché", () => {
    const next = "/client/missions/new?besoin=Repas"
    const html = renderToStaticMarkup(<LinkExpiredForm cause="expire" audience="client" role="client" next={next} />)
    expect(html).toContain(`href="/auth/login?next=${encodeURIComponent(next)}"`)
    expect(html).toContain(`name="next" value="${next}"`)
  })

  it("tutoie l'étudiant, vouvoie le client, sans durée ni tiret cadratin", () => {
    for (const cause of LINK_CAUSES) {
      for (const flow of ["signup", "recovery"]) {
        const student = text(renderToStaticMarkup(<LinkExpiredForm cause={cause} flow={flow} audience="student" />))
        const client = text(renderToStaticMarkup(<LinkExpiredForm cause={cause} flow={flow} audience="client" />))
        expect(student).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i)
        expect(client).not.toMatch(TU_FORMS)
        for (const body of [student, client]) expect(body).not.toMatch(/24 ?h|1 ?h\b|valable|réinscris/i)
      }
    }
    expect(JSON.stringify(LINK_EXPIRED_COPY)).not.toContain("\u2014")
  })
})

describe("page /auth/link-expired", () => {
  it("neutre : vouvoiement et panneau encre par défaut", async () => {
    const html = renderToStaticMarkup(await LinkExpiredPage({ searchParams: Promise.resolve({ cause: "expire" }) }))
    expect(html).toContain("auth__brand--client")
    expect(text(html)).toContain("Votre adresse email")
  })

  it("role=student : tutoiement ; flow=recovery transmis", async () => {
    const html = renderToStaticMarkup(
      await LinkExpiredPage({ searchParams: Promise.resolve({ cause: "expire", role: "student" }) })
    )
    expect(html).not.toContain("auth__brand--client")
    expect(text(html)).toContain("Ton adresse email")
    const recovery = renderToStaticMarkup(
      await LinkExpiredPage({ searchParams: Promise.resolve({ cause: "utilise", flow: "recovery" }) })
    )
    expect(recovery).toContain('href="/auth/forgot-password"')
  })
})
