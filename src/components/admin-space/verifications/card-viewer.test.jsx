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

const { CardViewer, fullscreenSupported, enterFullscreen, leaveFullscreen } = await import("./card-viewer")

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

/** Rendu suivant de la même instance : exécute les effets en attente puis refait le rendu. */
function rerender() {
  pending.splice(0).forEach((run) => run())
  slots.cursor = { ref: 0, state: 0, effect: 0 }
  return CardViewer({ cardView: image, name: "Codjo" })
}
/** Premier rendu, attache la visionneuse (ref) comme le ferait React, exécute les effets puis refait le rendu. */
function mount(viewer) {
  slots.cursor = { ref: 0, state: 0, effect: 0 }
  const first = CardViewer({ cardView: image, name: "Codjo" })
  find(first, (n) => n.props.className?.includes?.("a2-02-viewer"))[0].props.ref.current = viewer
  return rerender()
}
const fullscreenButton = (tree) => find(tree, (n) => n.type === "button" && n.props["aria-label"] === "Plein écran")[0]
const buttonByLabel = (tree, label) => find(tree, (n) => n.type === "button" && n.props["aria-label"] === label)[0]
const resetSlots = () => {
  slots.refs.length = 0
  slots.states.length = 0
  slots.effects.length = 0
  pending.length = 0
}
/** Document simulé : API plein écran présente, écouteurs `fullscreenchange` capturés. */
function fakeDocument() {
  const listeners = {}
  const doc = {
    fullscreenEnabled: true,
    fullscreenElement: null,
    body: { tag: "body" },
    activeElement: null,
    exitFullscreen: vi.fn().mockResolvedValue(undefined),
    addEventListener: (type, fn) => (listeners[type] = fn),
    removeEventListener: vi.fn(),
    fire: (type) => listeners[type]?.(),
  }
  doc.activeElement = doc.body
  return doc
}

describe("CardViewer : plein écran", () => {
  beforeEach(() => {
    simulate = true
    resetSlots()
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

  it("API disponible : bouton « Plein écran » qui passe la visionneuse en plein écran", () => {
    vi.stubGlobal("document", { fullscreenEnabled: true })
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const viewer = { requestFullscreen }
    const button = fullscreenButton(mount(viewer))
    expect(button).toBeDefined()
    expect(button.props.type).toBe("button")
    expect(button.props["aria-pressed"]).toBe(false)
    button.props.onClick()
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it("l'élément mis en plein écran contient toute la barre d'outils : zoom, rotation et sortie restent accessibles", () => {
    vi.stubGlobal("document", { fullscreenEnabled: true })
    // Chaque élément porteur d'une ref reçoit son propre objet DOM simulé : on retrouve celui passé en plein écran.
    slots.cursor = { ref: 0, state: 0, effect: 0 }
    const first = CardViewer({ cardView: image, name: "Codjo" })
    const targets = []
    for (const node of find(first, (n) => n.props.ref && typeof n.props.ref === "object")) {
      const el = { requestFullscreen: vi.fn(() => (targets.push(node), Promise.resolve())) }
      node.props.ref.current = el
    }
    const tree = rerender()
    fullscreenButton(tree).props.onClick()
    expect(targets).toHaveLength(1)
    const target = find(tree, (n) => n.props.className === targets[0].props.className)[0]
    const labels = find(target, (n) => n.type === "button").map((n) => n.props["aria-label"])
    expect(labels).toEqual(expect.arrayContaining(["Zoom arrière", "Zoom avant", "Pivoter de 90 degrés", "Plein écran"]))
    expect(find(target, (n) => n.type === "img")).toHaveLength(1)
  })

  it("en plein écran : bouton « Quitter le plein écran » (aria-pressed), zoom et rotation gardés, focus rendu à la sortie", () => {
    const doc = fakeDocument()
    vi.stubGlobal("document", doc)
    const viewer = { requestFullscreen: vi.fn().mockResolvedValue(undefined), contains: () => false }
    let tree = mount(viewer)
    fullscreenButton(tree).props.onClick()
    expect(viewer.requestFullscreen).toHaveBeenCalledTimes(1)

    doc.fullscreenElement = viewer
    doc.fire("fullscreenchange")
    tree = rerender()
    const quit = buttonByLabel(tree, "Quitter le plein écran")
    expect(quit).toBeDefined()
    expect(quit.props["aria-pressed"]).toBe(true)
    expect(fullscreenButton(tree)).toBeUndefined()

    // Zoom et rotation utilisables en plein écran, le nom de la carte reste celui du dossier.
    buttonByLabel(tree, "Zoom avant").props.onClick()
    tree = rerender()
    buttonByLabel(tree, "Pivoter de 90 degrés").props.onClick()
    tree = rerender()
    const img = find(tree, (n) => n.type === "img")[0]
    expect(img.props["data-zoom"]).toBe(150)
    expect(img.props["data-rot"]).toBe(90)
    expect(img.props.alt).toBe("Carte étudiante de Codjo")

    const focus = vi.fn()
    buttonByLabel(tree, "Quitter le plein écran").props.ref.current = { focus }
    buttonByLabel(tree, "Quitter le plein écran").props.onClick()
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(viewer.requestFullscreen).toHaveBeenCalledTimes(1)

    doc.fullscreenElement = null
    doc.fire("fullscreenchange")
    tree = rerender()
    const back = fullscreenButton(tree)
    expect(back.props["aria-pressed"]).toBe(false)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(find(tree, (n) => n.type === "img")[0].props["data-zoom"]).toBe(150)
  })

  it("sortie par Échap pendant qu'une confirmation a le focus : le focus n'est pas repris par le bouton", () => {
    const doc = fakeDocument()
    vi.stubGlobal("document", doc)
    const viewer = { requestFullscreen: vi.fn().mockResolvedValue(undefined), contains: () => false }
    let tree = mount(viewer)
    doc.fullscreenElement = viewer
    doc.fire("fullscreenchange")
    tree = rerender()
    const focus = vi.fn()
    buttonByLabel(tree, "Quitter le plein écran").props.ref.current = { focus }
    doc.activeElement = { tag: "dialog-button" }
    doc.fullscreenElement = null
    doc.fire("fullscreenchange")
    tree = rerender()
    expect(fullscreenButton(tree).props["aria-pressed"]).toBe(false)
    expect(focus).not.toHaveBeenCalled()
  })

  it("API absente : sortie sans effet et sans erreur, rendu intact", async () => {
    expect(() => leaveFullscreen(undefined)).not.toThrow()
    expect(() => leaveFullscreen({})).not.toThrow()
    expect(() => leaveFullscreen({ fullscreenElement: {} })).not.toThrow()
    const idle = vi.fn()
    leaveFullscreen({ fullscreenElement: null, exitFullscreen: idle })
    expect(idle).not.toHaveBeenCalled()
    const refused = vi.fn().mockRejectedValue(new Error("refus"))
    leaveFullscreen({ fullscreenElement: {}, exitFullscreen: refused })
    await Promise.resolve()
    expect(refused).toHaveBeenCalledTimes(1)
    const legacy = vi.fn(() => undefined)
    expect(() => leaveFullscreen({ fullscreenElement: {}, exitFullscreen: legacy })).not.toThrow()

    resetSlots()
    vi.stubGlobal("document", {})
    const tree = mount({})
    expect(fullscreenButton(tree)).toBeUndefined()
    expect(buttonByLabel(tree, "Zoom avant")).toBeDefined()
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
