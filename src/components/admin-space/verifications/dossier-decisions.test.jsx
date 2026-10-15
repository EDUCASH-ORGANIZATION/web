import { describe, it, expect, vi, beforeEach } from "vitest"

// Hooks simulés (même principe que dossier-panel-focus.test.jsx) : on appuie sur les vrais boutons du panneau, puis on
// confirme dans la vraie boîte ouverte, et on lit les arguments reçus par les actions serveur.
const newSlots = () => ({ refs: [], states: [], effects: [], cursor: { ref: 0, state: 0, effect: 0 } })
const hooks = { slots: newSlots() }
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRef: (initial) => {
      const s = hooks.slots
      const i = s.cursor.ref++
      if (!s.refs[i]) s.refs[i] = { current: initial }
      return s.refs[i]
    },
    useState: (initial) => {
      const s = hooks.slots
      const i = s.cursor.state++
      if (!(i in s.states)) s.states[i] = initial
      return [s.states[i], (v) => (s.states[i] = v)]
    },
    useEffect: () => {},
  }
})

const replace = vi.fn()
const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }) }))
const success = vi.fn()
vi.mock("@/components/app-ui/toast", () => ({ useAppToast: () => ({ success }) }))
vi.mock("./use-queue-shortcuts", () => ({ useQueueShortcuts: vi.fn() }))
const approveStudentCard = vi.fn()
const rejectStudentCard = vi.fn()
const resetStudentRejection = vi.fn()
const revokeStudentBadge = vi.fn()
vi.mock("@/lib/actions/admin-verifications.actions", () => ({
  approveStudentCard: (...a) => approveStudentCard(...a),
  rejectStudentCard: (...a) => rejectStudentCard(...a),
  resetStudentRejection: (...a) => resetStudentRejection(...a),
  revokeStudentBadge: (...a) => revokeStudentBadge(...a),
}))

const { DossierPanel } = await import("./dossier-panel")
const { useQueueShortcuts } = await import("./use-queue-shortcuts")
const { DossierReview } = await import("./dossier-review")
const { ApproveDialog } = await import("./approve-dialog")
const { RejectDialog } = await import("./reject-dialog")
const { ResetDialog } = await import("./reset-dialog")
const { RevokeDialog } = await import("./revoke-dialog")
const { CheckboxField } = await import("@/components/app-ui/fields")

const ID = "11111111-1111-4111-8111-111111111111"
const TOKEN = { expectedSubmittedAt: "2026-10-12T09:12:00Z", expectedCardPath: "id/card-1.jpg" }
const base = (over) => ({
  userId: ID, name: "Codjo Ahouansou", tab: "a-examiner", kind: "premiere", overdue48h: false, submittedAt: TOKEN.expectedSubmittedAt,
  cardPath: TOKEN.expectedCardPath, createdAt: "2026-10-10T18:40:00Z", verifiedUntil: null, rejectionReason: null, hasCard: true,
  cardView: { kind: "none", url: null }, actions: ["approve", "reject"], ...over,
})
const hrefs = { prev: null, next: null, afterDecision: "/admin/verifications?id=22", self: "/admin/verifications?id=11", list: "/admin/verifications" }

function find(node, match, out = []) {
  if (Array.isArray(node)) node.forEach((n) => find(n, match, out))
  else if (node && typeof node === "object" && node.props) {
    if (match(node)) out.push(node)
    find(node.props.children, match, out)
  }
  return out
}
const text = (node) => (Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : typeof node === "string" ? node : "")

let panel = newSlots()
function render(d) {
  hooks.slots = panel
  panel.cursor = { ref: 0, state: 0, effect: 0 }
  return DossierPanel({ dossier: d, hrefs, badgeUntil: "2027-10-15" })
}
// Boutons du bureau puis de la barre mobile ; on filtre sur les libellés de décision.
const decisionButtons = (tree) =>
  find(tree, (n) => n.type === "button" && /^(Valider|Refuser|Réinitialiser|Révoquer)/.test(text(n.props.children)))
const press = (tree, label) => find(tree, (n) => n.type === "button" && text(n.props.children).startsWith(label))
const openDialogs = (tree) =>
  [ApproveDialog, RejectDialog, ResetDialog, RevokeDialog].map((c) => find(tree, (n) => n.type === c)[0]).filter((d) => d.props.open)

beforeEach(() => {
  panel = newSlots()
  hooks.slots = panel
  for (const m of [replace, refresh, success, approveStudentCard, rejectStudentCard, resetStudentRejection, revokeStudentBadge]) m.mockReset()
  for (const m of [approveStudentCard, rejectStudentCard, resetStudentRejection, revokeStudentBadge]) m.mockResolvedValue({ success: true, emailSent: true })
})

/** Appuie sur le bouton `label` (bureau ou barre mobile), confirme dans la boîte ouverte avec `args`. */
async function decide(d, label, which, args) {
  press(render(d), label)[which].props.onClick()
  const tree = render(d)
  const dialogs = openDialogs(tree)
  expect(dialogs).toHaveLength(1)
  await dialogs[0].props.onConfirm(args)
}

describe("décisions : mêmes arguments qu'avant, onglet par onglet", () => {
  it("À examiner, Valider : jeton composite seul, bureau et mobile", async () => {
    for (const which of [0, 1]) {
      approveStudentCard.mockClear()
      await decide(base(), "Valider", which)
      expect(approveStudentCard).toHaveBeenCalledTimes(1)
      expect(approveStudentCard).toHaveBeenCalledWith(ID, TOKEN)
      expect(Object.keys(approveStudentCard.mock.calls[0][1]).sort()).toEqual(["expectedCardPath", "expectedSubmittedAt"])
      expect(rejectStudentCard).not.toHaveBeenCalled()
    }
  })

  it("À examiner, Refuser : motif, message et jeton ; jamais Valider", async () => {
    await decide(base(), "Refuser", 0, { reason: "Photo floue ou illisible", message: "Merci de renvoyer" })
    expect(rejectStudentCard).toHaveBeenCalledWith(ID, { reason: "Photo floue ou illisible", message: "Merci de renvoyer", ...TOKEN })
    expect(approveStudentCard).not.toHaveBeenCalled()
  })

  it("Refusés, Réinitialiser : motif seul, sans jeton", async () => {
    await decide(base({ tab: "refuses", actions: ["reset"], rejectionReason: "Photo floue" }), "Réinitialiser", 0, { reason: "Erreur de saisie" })
    expect(resetStudentRejection).toHaveBeenCalledWith(ID, { reason: "Erreur de saisie" })
    expect(success).toHaveBeenCalledWith("Dossier de Codjo Ahouansou réinitialisé", undefined)
    expect(approveStudentCard).not.toHaveBeenCalled()
    expect(revokeStudentBadge).not.toHaveBeenCalled()
  })

  it("Vérifiés et Expirés, Révoquer : motif seul", async () => {
    for (const tab of ["verifies", "expires"]) {
      revokeStudentBadge.mockClear()
      await decide(base({ tab, actions: ["revoke"], verifiedUntil: "2026-09-01" }), "Révoquer", 1, { reason: "Carte falsifiée" })
      expect(revokeStudentBadge).toHaveBeenCalledWith(ID, { reason: "Carte falsifiée" })
    }
    expect(approveStudentCard).not.toHaveBeenCalled()
  })

  it("Valider : la boîte reçoit le sous-titre « niveau · école » du dossier", () => {
    const approve = (d) => find(render(d), (n) => n.type === ApproveDialog)[0].props.caption
    expect(approve(base({ level: "Licence 3", school: "EPAC" }))).toBe("Licence 3 · EPAC")
    expect(approve(base({ level: null, school: "EPAC" }))).toBe("EPAC")
    expect(approve(base())).toBe("")
  })

  it("Incomplets : aucun bouton de décision ni barre mobile", () => {
    const tree = render(base({ tab: "incomplets", actions: [], hasCard: false, cardPath: null, submittedAt: null }))
    expect(decisionButtons(tree)).toHaveLength(0)
    expect(find(tree, (n) => n.props.className === "a2-mbar")).toHaveLength(0)
  })

  it("nom recopié et cases cochées ne figurent jamais dans un appel d'action", async () => {
    const review = (tree) => find(tree, (n) => n.type === DossierReview)[0]
    const own = newSlots()
    const run = (el) => {
      hooks.slots = own
      own.cursor = { ref: 0, state: 0, effect: 0 }
      try { return el.type(el.props) } finally { hooks.slots = panel }
    }
    const d = base()
    let tree = run(review(render(d)))
    find(tree, (n) => n.props.label === "Nom lu sur la carte")[0].props.onChange({ target: { value: "SECRET-NOM-RECOPIE" } })
    tree = run(review(render(d)))
    expect(find(tree, (n) => n.props.label === "Nom lu sur la carte")[0].props.value).toBe("SECRET-NOM-RECOPIE")
    const boxes = find(tree, (n) => n.type === CheckboxField)
    expect(boxes).toHaveLength(3)
    for (const box of boxes) box.props.onChange?.({ target: { checked: true } })
    await decide(d, "Valider", 0)
    await decide(d, "Refuser", 0, { reason: "Photo floue ou illisible", message: "" })
    const all = JSON.stringify([...approveStudentCard.mock.calls, ...rejectStudentCard.mock.calls])
    expect(all).not.toContain("SECRET-NOM-RECOPIE")
    expect(all).not.toMatch(/checked|typed|control/i)
    expect(JSON.stringify(replace.mock.calls)).not.toContain("SECRET")
  })
})

describe("ordre visuel et raccourcis", () => {
  it("Refuser est avant Valider et chaque bouton ouvre SA boîte", () => {
    const d = base()
    const labels = press(render(d), "").map((b) => text(b.props.children))
    expect(labels.filter((l) => /^(Refuser|Valider)/.test(l))).toEqual(["RefuserR", "ValiderV", "Refuser", "Valider"])
    panel = newSlots()
    press(render(d), "Refuser")[0].props.onClick()
    expect(openDialogs(render(d))[0].type).toBe(RejectDialog)
    panel = newSlots()
    press(render(d), "Valider")[0].props.onClick()
    expect(openDialogs(render(d))[0].type).toBe(ApproveDialog)
    expect(approveStudentCard).not.toHaveBeenCalled()
    expect(rejectStudentCard).not.toHaveBeenCalled()
  })

  it("V et R n'ouvrent que la modale : aucune action serveur", () => {
    const d = base()
    render(d)
    const { onApprove, onReject, allowed } = useQueueShortcuts.mock.calls.at(-1)[0]
    expect(allowed).toEqual(["approve", "reject"])
    onApprove()
    expect(openDialogs(render(d)).map((x) => x.type)).toEqual([ApproveDialog])
    panel = newSlots()
    render(d)
    useQueueShortcuts.mock.calls.at(-1)[0].onReject()
    expect(openDialogs(render(d)).map((x) => x.type)).toEqual([RejectDialog])
    for (const m of [approveStudentCard, rejectStudentCard, resetStudentRejection, revokeStudentBadge]) expect(m).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("bascule « dossier suivant » : présente seulement avec Valider", () => {
    const toggle = (t) => find(t, (n) => n.type === "input" && n.props.type === "checkbox")
    expect(toggle(render(base()))).toHaveLength(1)
    expect(toggle(render(base({ actions: ["reject"] })))).toHaveLength(0)
    expect(toggle(render(base({ tab: "refuses", actions: ["reset"] })))).toHaveLength(0)
    expect(toggle(render(base({ tab: "verifies", actions: ["revoke"] })))).toHaveLength(0)
    expect(toggle(render(base({ tab: "expires", actions: ["revoke"] })))).toHaveLength(0)
    expect(toggle(render(base({ tab: "incomplets", actions: [] })))).toHaveLength(0)
  })
})
