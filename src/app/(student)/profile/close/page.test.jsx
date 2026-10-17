import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/actions/account-closure.actions", () => ({ getMyClosurePreview: vi.fn(), closeMyAccount: vi.fn() }))

const { getMyClosurePreview } = await import("@/lib/actions/account-closure.actions")
const { default: Page } = await import("./page")

const text = (html) => html.replace(/<script>[^]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ")

beforeEach(() => vi.clearAllMocks())

describe("page Fermer mon compte (étudiant)", () => {
  it("affiche les blocages avec l'action étudiante", async () => {
    getMyClosurePreview.mockResolvedValue({
      blockers: [{ code: "RECENT_WITHDRAWAL", message: "Vous avez effectué un retrait récent." }],
      dueAt: "2026-10-31T10:00:00Z",
    })
    const html = renderToStaticMarkup(await Page())
    expect(text(html)).toContain("Vous avez effectué un retrait récent.")
    expect(html).toContain('href="/wallet"')
  })

  it("affiche la confirmation avec la carte étudiante parmi les données effacées", async () => {
    getMyClosurePreview.mockResolvedValue({ blockers: [], dueAt: "2026-10-31T10:00:00Z" })
    const html = renderToStaticMarkup(await Page())
    expect(html).toContain('name="password"')
    expect(text(html)).toContain("Votre carte étudiante")
    expect(html).toContain('href="/profile"')
  })

  it("affiche un état d'erreur si l'aperçu échoue", async () => {
    getMyClosurePreview.mockResolvedValue({ error: "x" })
    expect(text(renderToStaticMarkup(await Page()))).toContain("Impossible de vérifier votre compte")
  })
})
