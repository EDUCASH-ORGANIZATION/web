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
const { OfflineBanner, subscribeOnline, reconnectTransition } = await import("./offline-banner")

function render(onLine, props = {}) {
  vi.stubGlobal("navigator", { onLine })
  return renderToStaticMarkup(
    <ToastProvider>
      <OfflineBanner {...props} />
    </ToastProvider>,
  )
}

const noVersion = (html) => html.replace(/\?v=[0-9a-f]+/g, "?v=V")

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

describe("OfflineBanner : défauts inchangés et surcharge", () => {
  // Rendu consigné avant la paramétrisation (version du sprite normalisée).
  const BEFORE = "<div class=\"banner banner--encre banner--page\" role=\"status\"><svg class=\"ic\" aria-hidden=\"true\" focusable=\"false\"><use href=\"/sprite.svg?v=V#i-wifi-off\"></use></svg><div class=\"banner__body\"><div class=\"banner__title\">Vous êtes hors connexion</div>Vos actions seront de nouveau disponibles dès le retour du réseau.</div></div><div class=\"toasts ds-toasts-fixed toasts--bureau\"><div class=\"ds-toasts__zone\" role=\"status\" aria-live=\"polite\"></div><div class=\"ds-toasts__zone\" role=\"alert\" aria-live=\"assertive\"></div></div>"

  it("rendu hors ligne sans props : égal au rendu d'avant la paramétrisation", () => {
    expect(noVersion(render(false))).toBe(BEFORE)
  })

  it("les textes sont remplacés par les props et les défauts disparaissent", () => {
    const html = render(false, { title: "Titre neutre", text: "Texte neutre." })
    expect(html).toContain('<div class="banner__title">Titre neutre</div>Texte neutre.')
    expect(html).not.toContain("Vous êtes hors connexion")
    expect(html).not.toContain("Vos actions")
  })

  it("le texte de reconnexion par défaut est celui d'avant, surchargeable par prop", async () => {
    const mod = await import("./offline-banner")
    expect(mod.RECONNECTED_TEXT).toBe("Connexion rétablie")
    expect(mod.OFFLINE_TITLE).toBe("Vous êtes hors connexion")
    const source = (await import("node:fs")).readFileSync(new URL("./offline-banner.jsx", import.meta.url), "utf8")
    expect(source).toContain("success(reconnectedText)")
    expect(source).toContain("reconnectedText = RECONNECTED_TEXT")
  })
})

describe("subscribeOnline", () => {
  function fakeWindow() {
    const listeners = {}
    return {
      listeners,
      addEventListener: (type, fn) => { (listeners[type] ??= new Set()).add(fn) },
      removeEventListener: (type, fn) => { listeners[type]?.delete(fn) },
    }
  }

  it("écoute online et offline, appelle le rappel à chaque événement et se désabonne", () => {
    const win = fakeWindow()
    vi.stubGlobal("window", win)
    const onChange = vi.fn()
    const unsubscribe = subscribeOnline(onChange)
    expect(Object.keys(win.listeners).sort()).toEqual(["offline", "online"])
    for (const fn of win.listeners.online) fn()
    for (const fn of win.listeners.offline) fn()
    expect(onChange).toHaveBeenCalledTimes(2)
    unsubscribe()
    expect(win.listeners.online.size).toBe(0)
    expect(win.listeners.offline.size).toBe(0)
  })
})

describe("reconnectTransition et toast de reconnexion", () => {
  it("notifie une seule fois au retour du réseau, jamais au premier rendu en ligne", () => {
    expect(reconnectTransition(false, true)).toEqual({ wasOffline: false, notify: false })
    expect(reconnectTransition(false, false)).toEqual({ wasOffline: true, notify: false })
    expect(reconnectTransition(true, false)).toEqual({ wasOffline: true, notify: false })
    expect(reconnectTransition(true, true)).toEqual({ wasOffline: false, notify: true })
  })

  it("le texte du toast est « Connexion rétablie » et l'instantané serveur est en ligne", async () => {
    const source = (await import("node:fs")).readFileSync(new URL("./offline-banner.jsx", import.meta.url), "utf8")
    expect(source).toContain('RECONNECTED_TEXT = "Connexion rétablie"')
    expect(source).toContain("success(reconnectedText)")
    expect(source).toMatch(/useSyncExternalStore\(subscribeOnline, \(\) => navigator\.onLine, \(\) => true\)/)
  })
})
