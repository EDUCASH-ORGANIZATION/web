import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/actions/mission.actions", () => ({ confirmMission: vi.fn() }))

const { MissionFollowupView } = await import("../followup-view")

const student = {
  id: "s1", fullName: "Ulrich Zinsou", avatarUrl: null, city: "Cotonou", rating: 4.9, missionsDone: 23,
  isVerified: true, verifiedUntil: "2099-01-01", school: "IFRI", level: "Licence 2", skills: [],
}
const RESERVE = { type: "reserve", amount: 5000, createdAt: "2026-10-09T07:40:00Z" }
const DONE_LEDGER = [
  RESERVE,
  { type: "release", amount: 5000, createdAt: "2026-10-10T13:05:00Z" },
  { type: "commission", amount: 600, createdAt: "2026-10-10T13:05:00Z" },
]
const REFUND_LEDGER = [RESERVE, { type: "refund", amount: 5000, createdAt: "2026-10-11T09:00:00Z" }]
const LEDGERS = { in_progress: [RESERVE], done: DONE_LEDGER, cancelled: REFUND_LEDGER }

const req = (seq, status, amount, vendorName) => ({ id: `r${seq}`, seq, status, amount, vendorName, items: null })

function purchasesOf(requests) {
  const sum = (st) => requests.filter((r) => st.includes(r.status)).reduce((s, r) => s + r.amount, 0)
  const pending = requests.filter((r) => r.status === "pending").length
  const paid = sum(["paid", "received"])
  return {
    available: true,
    requests,
    totals: { count: requests.length, requested: sum(["pending", "paid", "received", "reported"]), paid, pending: sum(["pending"]), reported: 0 },
    exceedsEstimate: false,
    confirmWarning: { show: pending > 0, pending, reported: 0 },
    costTotal: paid > 0 ? { service: 5000, purchasesPaid: paid, total: 5000 + paid } : null,
  }
}

function detailOf(status, purchases) {
  return {
    mission: {
      id: "m1", title: "Courses au marché Dantokpa", description: "x", type: "Livraison", city: "Cotonou", budget: 5000,
      purchasesEstimate: 15000, urgency: "low", deadline: "2099-12-31", status, createdAt: "2026-10-09T07:40:00Z",
      selectedStudentId: "s1",
    },
    applications: [],
    selectedStudent: student,
    ledger: LEDGERS[status],
    review: null,
    ...(purchases === undefined ? {} : { purchases }),
  }
}

const FLAGS = { confirmer: true, publiee: false, paymentsEnabled: true }
const render = (d, flags = FLAGS) =>
  renderToStaticMarkup(<MissionFollowupView detail={d} flags={flags} />)
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

const PAID = [req(1, "received", 7450, "Ets Chez Maman Bénédicte"), req(2, "paid", 6200, "Boutique Sœur Odile")]

describe("followup-view : achats branchés sur C09 et C11", () => {
  it("C09 : la modale ouverte par ?confirmer=1 reçoit l'avertissement des demandes en attente", () => {
    const out = plain(render(detailOf("in_progress", purchasesOf([req(3, "pending", 4000, "Pharmacie du Port")]))))
    expect(out).toContain("1 demande de paiement d'achats en attente")
    expect(out).toContain("Vous pouvez confirmer la fin")
  })

  it("C09 : les achats déjà payés sont listés dans la modale", () => {
    const out = plain(render(detailOf("in_progress", purchasesOf(PAID))))
    expect(out).toContain("Achats payés en direct")
    expect(out).toContain("Ets Chez Maman Bénédicte")
  })

  it("C11 mission terminée : carte des achats payés et coût total", () => {
    const out = plain(render(detailOf("done", purchasesOf(PAID)), { confirmer: false, publiee: false, paymentsEnabled: true }))
    expect(out).toContain("Achats payés en direct")
    expect(out).toContain("Coût total")
    expect(out).toContain("Boutique Sœur Odile")
  })

  it("C11 mission annulée : le résumé rappelle les achats payés en direct", () => {
    const withPaid = plain(render(detailOf("cancelled", purchasesOf(PAID)), { confirmer: false, publiee: false, paymentsEnabled: true }))
    const without = plain(render(detailOf("cancelled"), { confirmer: false, publiee: false, paymentsEnabled: true }))
    expect(withPaid).not.toBe(without)
    expect(withPaid).toMatch(/achats/i)
  })

  it("lecture des achats indisponible : « Libérer le paiement » reste accessible par ?confirmer=1", () => {
    const out = plain(render(detailOf("in_progress", { available: false })))
    expect(out).toContain("Libérer le paiement")
    expect(out).not.toContain("demande de paiement d'achats en attente")
  })

  it.each(["in_progress", "done", "cancelled"])("%s sans achats : aucun libellé d'achats payés ni coût total, rendu identique à purchases indisponible", (status) => {
    const flags = { confirmer: status === "in_progress", publiee: false, paymentsEnabled: true }
    const absent = render(detailOf(status), flags)
    const unavailable = render(detailOf(status, { available: false }), flags)
    const empty = render(detailOf(status, purchasesOf([])), flags)
    for (const html of [absent, unavailable, empty]) {
      expect(plain(html)).not.toContain("Achats payés en direct")
      expect(plain(html)).not.toContain("Coût total")
      expect(plain(html)).not.toContain("demande de paiement d'achats en attente")
    }
    expect(unavailable).toBe(absent)
    expect(empty).toBe(absent)
  })
})
