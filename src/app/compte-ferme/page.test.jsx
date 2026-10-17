import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))

const { default: Page } = await import("./page")

const text = (html) => html.replace(/<script>[^]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ")
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString()
const render = async (query) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))

describe("page publique Compte fermé", () => {
  it("affiche la date limite valide lue dans l'URL", async () => {
    const html = await render({ jusquau: inDays(14) })
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(text(html)).toContain("Votre compte est fermé")
    expect(text(html)).toContain("Réactivable jusqu'au")
    expect(text(html)).toContain("avant cette date")
  })

  it("sans date ou avec une date douteuse : texte sans date", async () => {
    for (const query of [{}, { jusquau: "n'importe quoi" }, { jusquau: "2099-01-01" }, { jusquau: inDays(-30) }]) {
      const t = text(await render(query))
      expect(t).not.toContain("Réactivable jusqu'au")
      expect(t).toContain("dans les 14 jours")
    }
  })

  it("ne propose aucune action ni formulaire, seulement le retour à l'accueil", async () => {
    const html = await render({ jusquau: inDays(10) })
    expect(html).not.toContain("<form")
    expect(html).toContain('href="/"')
  })
})
