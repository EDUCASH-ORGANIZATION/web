import { describe, it, expect, vi, beforeEach } from "vitest"

// Hooks simulés : même instance de composant d'un rendu à l'autre (cas d'un dossier qui change dans la même vue).
const slots = { refs: [], states: [], effects: [], cursor: { ref: 0, state: 0, effect: 0 } }
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRef: (initial) => {
      const i = slots.cursor.ref++
      if (!slots.refs[i]) slots.refs[i] = { current: initial }
      return slots.refs[i]
    },
    useState: (initial) => {
      const i = slots.cursor.state++
      if (!slots.states[i]) slots.states[i] = initial
      return [slots.states[i], (value) => (slots.states[i] = value)]
    },
    useEffect: (run, deps) => {
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
vi.mock("@/lib/actions/admin-verifications.actions", () => ({
  approveStudentCard: (...a) => approveStudentCard(...a),
  rejectStudentCard: vi.fn(),
  resetStudentRejection: vi.fn(),
  revokeStudentBadge: vi.fn(),
}))

const { DossierPanel } = await import("./dossier-panel")

const ID1 = "11111111-1111-4111-8111-111111111111"
const ID2 = "22222222-2222-4222-8222-222222222222"
const dossier = (over) => ({
  userId: ID1, name: "Codjo Ahouansou", tab: "a-examiner", kind: "premiere", overdue48h: false, submittedAt: "2026-10-12T09:12:00Z",
  createdAt: "2026-10-10T18:40:00Z", verifiedUntil: null, rejectionReason: null, hasCard: true,
  cardView: { kind: "none", url: null }, actions: ["approve", "reject"], ...over,
})
const hrefs = { prev: null, next: null, afterDecision: "/admin/verifications?id=22" }

/** Parcourt l'arbre d'éléments rendu (sans le monter) et renvoie les éléments qui satisfont `match`. */
function find(node, match, out = []) {
  if (Array.isArray(node)) node.forEach((n) => find(n, match, out))
  else if (node && typeof node === "object" && node.props) {
    if (match(node)) out.push(node)
    find(node.props.children, match, out)
  }
  return out
}

function render(d) {
  slots.cursor = { ref: 0, state: 0, effect: 0 }
  const tree = DossierPanel({ dossier: d, hrefs, badgeUntil: "2027-10-15" })
  pending.splice(0).forEach((run) => run())
  return tree
}

describe("DossierPanel : focus après décision", () => {
  beforeEach(() => {
    slots.refs.length = 0
    slots.states.length = 0
    slots.effects.length = 0
    pending.length = 0
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
    expect(approveStudentCard).toHaveBeenCalledWith(ID2, { expectedSubmittedAt: "2026-10-12T09:12:00Z" })
    expect(replace).toHaveBeenCalledWith(hrefs.afterDecision)

    // Le dossier suivant arrive dans la même instance : le titre est focalisé.
    render(dossier({ userId: ID1, name: "Autre Étudiant" }))
    expect(focus).toHaveBeenCalledTimes(1)
  })
})
