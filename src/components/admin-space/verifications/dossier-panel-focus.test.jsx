import { describe, it, expect, vi, beforeEach } from "vitest"

// Hooks simulés : même instance de composant d'un rendu à l'autre (cas d'un dossier qui change dans la même vue).
// `hooks.slots` désigne l'instance en cours de rendu : le panneau, ou une instance de DossierReview (voir renderReview).
const newSlots = () => ({ refs: [], states: [], effects: [], cursor: { ref: 0, state: 0, effect: 0 } })
const hooks = { slots: newSlots() }
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRef: (initial) => {
      const slots = hooks.slots
      const i = slots.cursor.ref++
      if (!slots.refs[i]) slots.refs[i] = { current: initial }
      return slots.refs[i]
    },
    useState: (initial) => {
      const slots = hooks.slots
      const i = slots.cursor.state++
      if (!(i in slots.states)) slots.states[i] = initial // une valeur fausse (false, "") reste une valeur
      return [slots.states[i], (value) => (slots.states[i] = value)]
    },
    useEffect: (run, deps) => {
      const slots = hooks.slots
      const i = slots.cursor.effect++
      const previous = slots.effects[i]
      const changed = !previous || !deps || deps.some((d, k) => !Object.is(d, previous[k]))
      slots.effects[i] = deps
      if (changed) pending.push(run)
    },
  }
})
const pending = []

const replace = vi.fn()
const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }) }))
vi.mock("@/components/app-ui/toast", () => ({ useAppToast: () => ({ success: vi.fn() }) }))
vi.mock("./use-queue-shortcuts", () => ({ useQueueShortcuts: vi.fn() }))
const approveStudentCard = vi.fn()
const rejectStudentCard = vi.fn()
vi.mock("@/lib/actions/admin-verifications.actions", () => ({
  approveStudentCard: (...a) => approveStudentCard(...a),
  rejectStudentCard: (...a) => rejectStudentCard(...a),
  resetStudentRejection: vi.fn(),
  revokeStudentBadge: vi.fn(),
}))

const { DossierPanel } = await import("./dossier-panel")
const { DossierReview } = await import("./dossier-review")
const { CheckboxField } = await import("@/components/app-ui/fields")

const ID1 = "11111111-1111-4111-8111-111111111111"
const ID2 = "22222222-2222-4222-8222-222222222222"
const dossier = (over) => ({
  userId: ID1, name: "Codjo Ahouansou", tab: "a-examiner", kind: "premiere", overdue48h: false, submittedAt: "2026-10-12T09:12:00Z", cardPath: "id/card-1.jpg",
  createdAt: "2026-10-10T18:40:00Z", verifiedUntil: null, rejectionReason: null, hasCard: true,
  cardView: { kind: "none", url: null }, actions: ["approve", "reject"], ...over,
})
const hrefs = { prev: null, next: null, afterDecision: "/admin/verifications?id=22", self: "/admin/verifications?id=11", list: "/admin/verifications" }

/** Parcourt l'arbre d'éléments rendu (sans le monter) et renvoie les éléments qui satisfont `match`. */
function find(node, match, out = []) {
  if (Array.isArray(node)) node.forEach((n) => find(n, match, out))
  else if (node && typeof node === "object" && node.props) {
    if (match(node)) out.push(node)
    find(node.props.children, match, out)
  }
  return out
}

let panel = newSlots()
function render(d) {
  hooks.slots = panel
  panel.cursor = { ref: 0, state: 0, effect: 0 }
  const tree = DossierPanel({ dossier: d, hrefs, badgeUntil: "2027-10-15" })
  pending.splice(0).forEach((run) => run())
  return tree
}

// Réconciliation de React simulée pour l'enfant DossierReview : même type et même `key` = même instance (état gardé),
// `key` différente = nouvelle instance (état remis à zéro, champs non contrôlés recréés).
const reviews = new Map()
function renderReview(tree) {
  const element = find(tree, (n) => n.type === DossierReview)[0]
  const identity = element.key ?? "(sans key)"
  if (!reviews.has(identity)) reviews.set(identity, newSlots())
  const own = reviews.get(identity)
  own.cursor = { ref: 0, state: 0, effect: 0 }
  hooks.slots = own
  try {
    return { identity, tree: element.type(element.props) }
  } finally {
    hooks.slots = panel
  }
}
const nameField = (review) => find(review, (n) => n.props.label === "Nom lu sur la carte")[0]
const typedCell = (review) => find(review, (n) => n.type === "td" && n.props["data-label"] === "Saisi avec la carte")[0]

describe("DossierPanel : focus après décision", () => {
  beforeEach(() => {
    panel = newSlots()
    hooks.slots = panel
    reviews.clear()
    pending.length = 0
    replace.mockReset()
    approveStudentCard.mockReset()
    approveStudentCard.mockResolvedValue({ success: true, emailSent: true })
  })

  it("après une validation, le titre du dossier suivant reçoit le focus ; sans décision, il ne le reçoit pas", async () => {
    const first = render(dossier())
    const heading = find(first, (n) => n.type === "h2")[0]
    const focus = vi.fn()
    heading.props.ref.current = { focus }
    expect(focus).not.toHaveBeenCalled()

    // Changement de dossier sans décision (navigation dans la liste) : pas de vol de focus.
    render(dossier({ userId: ID2, name: "Nadège Kpadonou" }))
    expect(focus).not.toHaveBeenCalled()

    const approve = find(render(dossier({ userId: ID2 })), (n) => typeof n.props.onConfirm === "function" && "badgeUntil" in n.props)[0]
    await approve.props.onConfirm()
    expect(approveStudentCard).toHaveBeenCalledWith(ID2, { expectedSubmittedAt: "2026-10-12T09:12:00Z", expectedCardPath: "id/card-1.jpg" })
    expect(replace).toHaveBeenCalledWith(hrefs.afterDecision)

    // Le dossier suivant arrive dans la même instance : le titre est focalisé.
    render(dossier({ userId: ID1, name: "Autre Étudiant" }))
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it("la décision n'envoie que le jeton (date et chemin de carte), le motif et le message : aucune saisie de revue", async () => {
    rejectStudentCard.mockReset()
    rejectStudentCard.mockResolvedValue({ success: true, emailSent: true })
    const reject = find(render(dossier()), (n) => typeof n.props.onConfirm === "function" && !("badgeUntil" in n.props) && "name" in n.props)[0]
    await reject.props.onConfirm({ reason: "Photo floue ou illisible", message: "" })
    expect(rejectStudentCard).toHaveBeenCalledTimes(1)
    const [id, payload] = rejectStudentCard.mock.calls[0]
    expect(id).toBe(ID1)
    expect(Object.keys(payload).sort()).toEqual(["expectedCardPath", "expectedSubmittedAt", "message", "reason"])
    expect(payload).toMatchObject({ expectedSubmittedAt: "2026-10-12T09:12:00Z", expectedCardPath: "id/card-1.jpg" })
  })

  it("changement de dossier : le nom saisi et les cases de contrôle repartent à vide", () => {
    const first = renderReview(render(dossier()))
    nameField(first.tree).props.onChange({ target: { value: "Codjo Ahouansou" } })
    const typed = renderReview(render(dossier()))
    expect(nameField(typed.tree).props.value).toBe("Codjo Ahouansou")
    expect(find(typedCell(typed.tree), (n) => n.type === "b")[0].props.children).toBe("Codjo Ahouansou")

    const other = renderReview(render(dossier({ userId: ID2, name: "Nadège Kpadonou" })))
    expect(other.identity).not.toBe(first.identity)
    expect(nameField(other.tree).props.value).toBe("")
    expect(find(typedCell(other.tree), (n) => n.type === "b")[0].props.children).toBe("Non renseigné")
    expect(find(other.tree, (n) => n.props.className?.includes?.("a2-02-namecheck"))).toHaveLength(0)
    // Cases non contrôlées, recréées avec la nouvelle instance : aucune n'arrive cochée.
    const boxes = find(other.tree, (n) => n.type === CheckboxField)
    expect(boxes).toHaveLength(3)
    for (const box of boxes) {
      expect(box.props.checked).toBeUndefined()
      expect(box.props.defaultChecked).toBeUndefined()
    }
  })

  it("bascule désactivée : le dossier reste affiché, la bascule reste décochée et le titre reçoit le focus au nouvel état", async () => {
    const toggle = (tree) => find(tree, (n) => n.type === "input" && n.props.type === "checkbox")[0]
    toggle(render(dossier())).props.onChange({ target: { checked: false } })
    const tree = render(dossier())
    expect(toggle(tree).props.checked).toBe(false)
    const focus = vi.fn()
    find(tree, (n) => n.type === "h2")[0].props.ref.current = { focus }

    const approve = find(tree, (n) => typeof n.props.onConfirm === "function" && "badgeUntil" in n.props)[0]
    expect(approve.props.advance).toBe(false)
    await approve.props.onConfirm()
    expect(replace).toHaveBeenCalledWith(hrefs.self)
    expect(replace).not.toHaveBeenCalledWith(hrefs.list)

    // Données rechargées : même dossier, nouvel onglet. Pastille annoncée, focus sur le titre, choix conservé.
    const after = render(dossier({ tab: "verifies", actions: ["revoke"] }))
    expect(focus).toHaveBeenCalledTimes(1)
    expect(toggle(after).props.checked).toBe(false)
    const live = find(after, (n) => n.props["aria-live"] === "polite")[0]
    expect(live.props.children.props).toMatchObject({ label: "Vérifié", tone: "succes" })
    render(dossier({ tab: "verifies", actions: ["revoke"] }))
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it("avatar décoratif : masqué aux lecteurs d'écran, le nom n'est annoncé que par le titre", () => {
    const tree = render(dossier())
    const avatar = find(tree, (n) => n.props.className === "a2-02-avatar")[0]
    expect(avatar.props["aria-hidden"]).toBe("true")
  })
})
