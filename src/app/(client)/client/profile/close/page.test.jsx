import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/actions/account-closure.actions", () => ({ getMyClosurePreview: vi.fn(), closeMyAccount: vi.fn() }))

const { getMyClosurePreview } = await import("@/lib/actions/account-closure.actions")
const { default: Page } = await import("./page")

const text = (html) => html.replace(/<script>[^]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ")

beforeEach(() => vi.clearAllMocks())

describe("page Fermer mon compte (client)", () => {
  it("affiche les blocages renvoyés par l'aperçu", async () => {
    getMyClosurePreview.mockResolvedValue({
      blockers: [{ code: "MISSION_CLIENT_ACTIVE", message: "Vous avez une mission ouverte." }],
      dueAt: "2026-10-31T10:00:00Z",
    })
    const html = renderToStaticMarkup(await Page())
    expect(text(html)).toContain("Vous avez une mission ouverte.")
    expect(html).toContain('href="/client/missions"')
    expect(html).not.toContain("<form")
  })

  it("affiche la confirmation sans blocage", async () => {
    getMyClosurePreview.mockResolvedValue({ blockers: [], dueAt: "2026-10-31T10:00:00Z" })
    const html = renderToStaticMarkup(await Page())
    expect(html).toContain('name="confirmation"')
    expect(html).toContain('href="/client/profile"')
  })

  it("affiche un état d'erreur si l'aperçu échoue", async () => {
    getMyClosurePreview.mockResolvedValue({ error: "Vous devez être connecté pour effectuer cette action." })
    expect(text(renderToStaticMarkup(await Page()))).toContain("Impossible de vérifier votre compte")
  })
})
