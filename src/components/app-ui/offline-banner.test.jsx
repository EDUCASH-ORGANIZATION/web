import { afterEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

// Rendu statique : useSyncExternalStore renvoie sinon toujours son instantané serveur (en ligne).
// On lui fait lire navigator.onLine, simulé par test, comme le ferait le navigateur.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() }
})
vi.mock("./modal", () => ({ useIsCompact: () => false }))

const { ToastProvider } = await import("./toast")
const { OfflineBanner } = await import("./offline-banner")

function render(onLine) {
  vi.stubGlobal("navigator", { onLine })
  return renderToStaticMarkup(
    <ToastProvider>
      <OfflineBanner />
    </ToastProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe("OfflineBanner sous ToastProvider", () => {
  it("en ligne : aucun bandeau", () => {
    const html = render(true)
    expect(html).not.toContain("banner")
    expect(html).not.toContain("hors connexion")
  })

  it("hors ligne : bandeau role=status au texte vouvoyé", () => {
    const html = render(false)
    expect(html).toContain('role="status"')
    expect(html).toContain("banner banner--encre")
    expect(html).toContain("Vous êtes hors connexion")
    expect(html).toContain("Vos actions seront de nouveau disponibles")
    const text = html.replace(/<[^>]+>/g, " ")
    expect(text).toMatch(/\bVous\b/)
    expect(text).not.toMatch(/(?<![\p{L}-])(?:tu|ton|ta|tes|te|toi)(?![\p{L}])/iu)
  })
})
