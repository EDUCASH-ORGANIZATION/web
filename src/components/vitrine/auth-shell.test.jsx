import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))

const { AuthShell } = await import("./auth-shell")

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

describe("AuthShell", () => {
  it("rend la racine .ds, le gabarit .auth et le panneau bleu étudiant tutoyé", () => {
    const html = renderToStaticMarkup(
      <AuthShell audience="student">
        <form className="auth__form" />
      </AuthShell>
    )
    expect(html).toContain('class="ds"')
    expect(html).toContain('class="auth"')
    expect(html).toContain("auth__brand grid-bg")
    expect(html).not.toContain("auth__brand--client")
    expect(html).toContain('<form class="auth__form">')
    expect(html).toContain("Le client bloque l&#x27;argent avant que tu commences.")
    expect(text(html)).not.toMatch(/\b(vous|votre|vos)\b/i)
  })

  it("rend le panneau encre client vouvoyé, sans délai ni prestataire", () => {
    const html = renderToStaticMarkup(<AuthShell audience="client"><div /></AuthShell>)
    expect(html).toContain("auth__brand auth__brand--client grid-bg")
    expect(text(html)).toMatch(/\bvotre\b/i)
    expect(text(html)).not.toMatch(/\b(tu|te|ton|ta|tes)\b/i)
    expect(html).not.toMatch(/FedaPay|\b24\b|\b48\b/)
  })

  it("cite les trois opérateurs Mobile Money côté étudiant", () => {
    const html = renderToStaticMarkup(<AuthShell><div /></AuthShell>)
    expect(html).toContain("MTN MoMo, Moov Money ou Celtiis Cash")
  })

  it("rend le lien de retour, le logo et l'en-tête mobile", () => {
    const html = renderToStaticMarkup(
      <AuthShell backHref="/auth/register" backLabel="Retour à l'inscription"><div /></AuthShell>
    )
    expect(html).toContain('<a href="/auth/register" class="auth__back">')
    expect(html).toContain('class="auth__top"')
    expect(html).toContain('aria-label="Retour à l&#x27;inscription"')
    expect(html).toContain("/logo-horizontal-blanc.svg")
    expect(html).toContain("/logo-horizontal-bleu.svg")
  })

  it("accepte encore title, subtitle et maxWidth des pages de main", () => {
    const html = renderToStaticMarkup(
      <AuthShell title="Crée ton compte" subtitle="Gratuit" maxWidth={560}>
        <p>contenu</p>
      </AuthShell>
    )
    expect(html).toContain('<div class="auth__form">')
    expect(html).toContain('<h1 class="ds-h1">Crée ton compte</h1>')
    expect(html).toContain("Gratuit")
    expect(html).toContain("<p>contenu</p>")
    expect(html).not.toContain("maxWidth")
  })
})
