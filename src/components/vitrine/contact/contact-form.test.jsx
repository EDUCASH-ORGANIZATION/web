import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("@/lib/actions/contact.actions", () => ({ sendContactMessage: vi.fn() }))

const { ContactForm } = await import("./contact-form")

describe("ContactForm", () => {
  it("rend le formulaire vide avec les 6 sujets et le honeypot masque", () => {
    const html = renderToStaticMarkup(<ContactForm />)
    expect(html.match(/<option /g)).toHaveLength(7)
    expect(html).toContain('name="website"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain("0 / 1 000")
    expect(html).not.toContain("is-error")
    expect(html).not.toContain("à corriger")
    expect(html).toContain("select is-placeholder")
  })

  it("ne marque pas le sujet comme vide quand il est présélectionné", () => {
    const html = renderToStaticMarkup(<ContactForm defaultSubject="signalement" />)
    expect(html).not.toContain("is-placeholder")
  })
})
