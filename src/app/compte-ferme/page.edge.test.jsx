import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))

const { default: Page } = await import("./page")
const text = (html) => html.replace(/<script>[^]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ")
const DAY = 24 * 60 * 60 * 1000
const render = async (query) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))

describe("compte-ferme : cas limites", () => {
  it("ne touche ni session ni données : aucun import d'auth ou de Supabase", () => {
    const src = readFileSync(path.resolve(__dirname, "page.js"), "utf8")
    expect(src).not.toMatch(/supabase|require-role|requireUser|cookies\(/)
  })

  it("rend sans searchParams du tout", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(undefined) }))
    expect(text(html)).not.toContain("Réactivable jusqu'au")
    expect(text(html)).toContain("Votre compte est fermé")
  })

  it.each([
    "2026-13-45T10:00:00Z",
    "<script>alert(1)</script>",
    "",
    "   ",
    "1e9",
    "0",
    "2026-10-31T10:00:00Zjunk",
    "Sat, 31 Oct 2026 10:00:00 GMT",
  ])("date malformée %j : texte sans date, sans écho de la valeur", async (value) => {
    const html = await render({ jusquau: value })
    const t = text(html)
    expect(t).not.toContain("Réactivable jusqu'au")
    expect(t).toContain("dans les 14 jours")
    if (value.trim()) expect(html).not.toContain("alert(1)")
  })

  it("hors fenêtre (passée de plus d'un jour, ou au-delà du délai plus un jour) : sans date", async () => {
    for (const n of [-2, 16, 400]) {
      const t = text(await render({ jusquau: new Date(Date.now() + n * DAY).toISOString() }))
      expect(t).not.toContain("Réactivable jusqu'au")
    }
  })

  it("dans la fenêtre : date affichée", async () => {
    for (const n of [0, 7, 14]) {
      const t = text(await render({ jusquau: new Date(Date.now() + n * DAY).toISOString() }))
      expect(t).toContain("Réactivable jusqu'au")
    }
  })
})
