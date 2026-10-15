import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

// Hooks simulés (une seule instance) : permet d'exécuter l'effet de détection du plein écran sans DOM.
const slots = { refs: [], states: [], effects: [], cursor: { ref: 0, state: 0, effect: 0 } }
const pending = []
let simulate = false
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRef: (initial) => {
      if (!simulate) return actual.useRef(initial)
      const i = slots.cursor.ref++
      if (!slots.refs[i]) slots.refs[i] = { current: initial }
      return slots.refs[i]
    },
    useState: (initial) => {
      if (!simulate) return actual.useState(initial)
      const i = slots.cursor.state++
      if (!(i in slots.states)) slots.states[i] = initial
      return [slots.states[i], (value) => (slots.states[i] = value)]
    },
    useEffect: (run, deps) => {
      if (!simulate) return actual.useEffect(run, deps)
      const i = slots.cursor.effect++
      const previous = slots.effects[i]
      const changed = !previous || !deps || deps.some((d, k) => !Object.is(d, previous[k]))
      slots.effects[i] = deps
      if (changed) pending.push(run)
    },
  }
})
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { CardViewer, fullscreenSupported, enterFullscreen } = await import("./card-viewer")

const SIGNED = "https://storage.example/sign/cards/u1.jpg?token=SECRET"
const image = { kind: "image", url: SIGNED }

function find(node, match, out = []) {
  if (Array.isArray(node)) node.forEach((child) => find(child, match, out))
  else if (node && typeof node === "object" && node.props) {
    if (match(node)) out.push(node)
    find(node.props.children, match, out)
  }
  return out
}

/** Premier rendu, attache la scène (ref) comme le ferait React, exécute les effets puis refait le rendu. */
function mount(stage) {
  slots.cursor = { ref: 0, state: 0, effect: 0 }
  const first = CardViewer({ cardView: image, name: "Codjo" })
  find(first, (n) => n.props.className === "a2-02-stage")[0].props.ref.current = stage
  pending.splice(0).forEach((run) => run())
  slots.cursor = { ref: 0, state: 0, effect: 0 }
  return CardViewer({ cardView: image, name: "Codjo" })
}
const fullscreenButton = (tree) => find(tree, (n) => n.type === "button" && n.props["aria-label"] === "Plein écran")[0]

describe("CardViewer : plein écran", () => {
  beforeEach(() => {
    simulate = true
    slots.refs.length = 0
    slots.states.length = 0
    slots.effects.length = 0
    pending.length = 0
  })
  afterEach(() => {
    simulate = false
    vi.unstubAllGlobals()
  })

  it("aucun lien vers l'URL signée pour une image : rien n'entre dans l'historique du navigateur", () => {
    simulate = false
    const html = renderToStaticMarkup(<CardViewer cardView={image} name="Codjo" />)
    expect(html).not.toMatch(/<a [^>]*href="https:\/\/storage\.example/)
    expect(html).not.toContain("nouvel onglet")
    expect(html).not.toContain('target="_blank"')
    expect(html).toContain('data-zoom="100"')
  })

  it("API disponible : bouton « Plein écran » qui passe la scène en plein écran", () => {
    vi.stubGlobal("document", { fullscreenEnabled: true })
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const stage = { requestFullscreen }
    const button = fullscreenButton(mount(stage))
    expect(button).toBeDefined()
    expect(button.props.type).toBe("button")
    button.props.onClick()
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it("API absente ou refusée : bouton masqué", () => {
    vi.stubGlobal("document", { fullscreenEnabled: false })
    expect(fullscreenButton(mount({ requestFullscreen: vi.fn() }))).toBeUndefined()
    slots.refs.length = 0
    slots.states.length = 0
    slots.effects.length = 0
    vi.stubGlobal("document", { fullscreenEnabled: true })
    expect(fullscreenButton(mount({}))).toBeUndefined()
  })

  it("aides : détection et refus du navigateur sans erreur", async () => {
    expect(fullscreenSupported(undefined, undefined)).toBe(false)
    expect(fullscreenSupported({ fullscreenEnabled: true }, { requestFullscreen() {} })).toBe(true)
    expect(() => enterFullscreen(null)).not.toThrow()
    const refused = vi.fn().mockRejectedValue(new Error("refus"))
    enterFullscreen({ requestFullscreen: refused })
    await Promise.resolve()
    expect(refused).toHaveBeenCalledTimes(1)
  })

  it("PDF : le lien « Ouvrir le PDF » reste", () => {
    simulate = false
    const html = renderToStaticMarkup(<CardViewer cardView={{ kind: "pdf", url: SIGNED }} name="Codjo" />)
    expect(html).toContain("Ouvrir le PDF")
    expect(html).toContain('rel="noopener noreferrer"')
  })
})
