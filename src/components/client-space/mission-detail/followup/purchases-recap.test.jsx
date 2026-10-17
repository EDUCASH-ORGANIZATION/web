import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/actions/mission.actions", () => ({ confirmMission: vi.fn() }))

const { ConfirmEndDialogView, PurchasesWarning, releaseOnce } = await import("./confirm-end-dialog")
const { Receipt, CostTotalCard, DonePurchasesCard, PaidPurchasesCard, paidRequests } = await import("./receipt")
const { CancelledSummary } = await import("./cancelled-summary")
const { missionView } = await import("@/lib/client-space/mission-view")
const { escrowSplit } = await import("@/lib/app/money")

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

const req = (seq, status, amount, vendorName, extra = {}) => ({ id: `r${seq}`, seq, status, amount, vendorName, items: null, ...extra })
const PAID_1 = req(1, "received", 7450, "Ets Chez Maman Bénédicte", { items: "légumes, piment" })
const PAID_2 = req(2, "paid", 6200, "Boutique Sœur Odile")
const PENDING = req(3, "pending", 4000, "Pharmacie du Port")
const REPORTED = req(4, "reported", 3000, "Vendeur contesté")

function purchasesOf(requests, over = {}) {
  const sum = (st) => requests.filter((r) => st.includes(r.status)).reduce((s, r) => s + r.amount, 0)
  const totals = {
    count: requests.length, requested: requests.reduce((s, r) => s + r.amount, 0),
    paid: sum(["paid", "received"]), pending: sum(["pending"]), reported: sum(["reported"]),
  }
  const pending = requests.filter((r) => r.status === "pending").length
  const reported = requests.filter((r) => r.status === "reported").length
  return {
    available: true, requests, totals, exceedsEstimate: false,
    confirmWarning: { show: pending + reported > 0, pending, reported },
    costTotal: totals.paid > 0 ? { service: 5000, purchasesPaid: totals.paid, total: 5000 + totals.paid } : null,
    ...over,
  }
}

function detailOf(status, purchases, mission = {}) {
  return {
    mission: {
      id: "m1", title: "Courses au marché Dantokpa", description: "x", type: "Livraison", city: "Cotonou", budget: 5000,
      purchasesEstimate: 15000, urgency: "low", deadline: "2099-12-31", status, createdAt: "2026-10-09T07:40:00Z",
      selectedStudentId: "s1", ...mission,
    },
    applications: [],
    selectedStudent: student,
    ledger: status === "done" ? DONE_LEDGER : status === "cancelled" ? REFUND_LEDGER : [RESERVE],
    review: null,
    ...(purchases === undefined ? {} : { purchases }),
  }
}

const text = (html) => html.replaceAll("&#x27;", "'").replaceAll("&amp;", "&")
const plain = (html) => text(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
const section = (html, label) => {
  const m = html.match(new RegExp(`<section[^>]*aria-label="${label}"[\\s\\S]*?</section>`))
  return m ? m[0] : null
}
const num = (n) => new RegExp(String(n).replace(/(\d)(?=(\d{3})$)/, "$1[\\s\\u00a0\\u202f]"))

const SPLIT = escrowSplit(5000)
const baseDialog = {
  title: "Courses au marché", studentName: "Ulrich", split: SPLIT, since: "9 oct.",
  checked: false, pending: false, error: null, onCheck() {}, onSubmit() {}, onCancel() {}, checkRef: { current: null },
}
const dialog = (over) => text(renderToStaticMarkup(<ConfirmEndDialogView {...baseDialog} {...over} />))
const receipt = (d, purchases) => {
  const view = missionView(d)
  return text(renderToStaticMarkup(
    <Receipt view={view} ledger={d.ledger} studentName="Ulrich" withPurchases purchases={purchases} />,
  ))
}
const cancelled = (d, purchases) =>
  text(renderToStaticMarkup(<CancelledSummary mission={d.mission} view={missionView(d)} applicationsCount={0} purchases={purchases} />))

describe("C09 avertissement des achats : jamais bloquant", () => {
  it("demande en attente : avertissement, la libération reste possible une fois la case cochée", () => {
    const purchases = purchasesOf([PENDING])
    const out = dialog({ purchases, checked: true })
    expect(plain(out)).toContain("1 demande de paiement d'achats en attente")
    expect(plain(out)).toContain("Vous pouvez confirmer la fin : ces achats restent hors EduCash.")
    expect(out).toContain('role="status"')
    expect(out).not.toMatch(/disabled=""[^>]*>(<svg[^>]*>.*?<\/svg>)?Libérer le paiement/)
  })

  it("demande en attente et case décochée : le seul verrou est la case, comme sans achats", () => {
    const out = dialog({ purchases: purchasesOf([PENDING]) })
    expect(out).toMatch(/disabled=""[^>]*>(<svg[^>]*>.*?<\/svg>)?Libérer le paiement/)
    expect(out.match(/disabled=""/g)).toHaveLength(dialog({}).match(/disabled=""/g).length)
  })

  it("plusieurs demandes en attente et une signalée : décompte au pluriel, signalement non clos", () => {
    const purchases = purchasesOf([PENDING, req(5, "pending", 1000, "Autre"), REPORTED])
    const out = plain(dialog({ purchases, checked: true }))
    expect(out).toContain("2 demandes de paiement d'achats en attente et 1 demande d'achats signalée")
    expect(out).toContain("ne clôt pas le signalement")
  })

  it("seulement des demandes signalées : titre sur le signalement", () => {
    const out = dialog({ purchases: purchasesOf([REPORTED, req(6, "reported", 900, "Un autre")]), checked: true })
    expect(plain(out)).toContain("2 demandes d'achats signalées")
    expect(plain(out)).not.toContain("en attente")
  })

  it("avertissement et pastille ne retardent pas l'action : releaseOnce appelle l'action une seule fois", async () => {
    const confirm = vi.fn().mockResolvedValue({ success: true, amountStudent: 4400 })
    const result = await releaseOnce({ busy: false }, confirm, "m1")
    expect(result).toEqual({ amount: 4400 })
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it("une demande reçue ou payée ne déclenche aucun avertissement", () => {
    const out = plain(dialog({ purchases: purchasesOf([PAID_1, PAID_2]), checked: true }))
    expect(out).not.toContain("en attente")
    expect(out).not.toContain("signalée")
  })

  it("achats payés listés à part, hors séquestre, et la ligne « Versé » reste le service seul", () => {
    const out = dialog({ purchases: purchasesOf([PAID_1, PAID_2]), checked: true })
    const flat = plain(out)
    expect(flat).toContain("Achats payés en direct")
    expect(flat).toContain("Hors séquestre")
    expect(flat).toContain("Ets Chez Maman Bénédicte")
    expect(flat).toContain("Ces montants ne sont ni libérés ni remboursés par EduCash")
    expect(flat).toMatch(/Versé à Ulrich\s+4[\s  ]400/)
    expect(flat).toMatch(/Libérer le paiement/)
  })

  it("un seul bouton encre dans la modale, avec ou sans avertissement", () => {
    const out = dialog({ purchases: purchasesOf([PENDING, REPORTED]), checked: true })
    expect(out.match(/btn--dark/g)).toHaveLength(1)
  })

  it("rendu strictement inchangé sans achats (script 94 absent, mission sans achats, rien à signaler)", () => {
    const reference = dialog({})
    expect(dialog({ purchases: undefined })).toBe(reference)
    expect(dialog({ purchases: null })).toBe(reference)
    expect(dialog({ purchases: { available: false } })).toBe(reference)
    expect(dialog({ purchases: purchasesOf([]) })).toBe(reference)
    expect(dialog({ purchases: purchasesOf([PENDING], { confirmWarning: { show: false, pending: 1, reported: 0 } }) })).toBe(reference)
  })

  it("PurchasesWarning : show absent ou faux ne rend rien, données absurdes sans NaN", () => {
    expect(renderToStaticMarkup(<PurchasesWarning warning={undefined} />)).toBe("")
    expect(renderToStaticMarkup(<PurchasesWarning warning={{ show: false, pending: 3, reported: 0 }} />)).toBe("")
    const odd = text(renderToStaticMarkup(<PurchasesWarning warning={{ show: true, pending: "x", reported: -2 }} />))
    expect(odd).not.toMatch(/NaN|undefined/)
    expect(plain(odd)).toContain("Une demande d'achats n'est pas réglée")
  })
})

describe("C11 reçu : Coût total", () => {
  it("avec achats payés : service + achats payés, jamais l'estimation", () => {
    const d = detailOf("done", purchasesOf([PAID_1, PAID_2]))
    const out = receipt(d, d.purchases)
    const cost = plain(section(out, "Coût total"))
    expect(cost).toMatch(num(5000))
    expect(cost).toMatch(num(13650))
    expect(cost).toMatch(num(18650))
    expect(cost).not.toMatch(num(15000))
    expect(cost).not.toMatch(num(20000))
  })

  it("le reçu du service garde le grand livre : prélevé 5 000, commission 600, versé 4 400, sans achat", () => {
    const d = detailOf("done", purchasesOf([PAID_1, PAID_2]))
    const service = plain(section(receipt(d, d.purchases), "Reçu du service"))
    expect(service).toMatch(num(5000))
    expect(service).toMatch(/−\s?600/)
    expect(service).toMatch(/Versé à Ulrich\s+4[\s  ]400/)
    expect(service).not.toMatch(num(13650))
    expect(service).not.toMatch(num(18650))
    expect(service).not.toMatch(/Hors EduCash|vous touchez/i)
  })

  it("demandes signalées exclues du coût total et dites à voix haute", () => {
    const d = detailOf("done", purchasesOf([PAID_1, PAID_2, REPORTED]))
    const cost = plain(section(receipt(d, d.purchases), "Coût total"))
    expect(cost).toMatch(num(18650))
    expect(cost).not.toMatch(num(21650))
    expect(cost).toContain("Signalés, non comptés")
    expect(cost).toMatch(/Signalés, non comptés\s+3[\s  ]000/)
  })

  it("seulement des demandes signalées : costTotal null, aucune carte Coût total", () => {
    const d = detailOf("done", purchasesOf([REPORTED]))
    expect(d.purchases.costTotal).toBeNull()
    expect(section(receipt(d, d.purchases), "Coût total")).toBeNull()
  })

  it("rendu du reçu strictement inchangé sans achats payés ni données", () => {
    const d = detailOf("done")
    const reference = receipt(d, undefined)
    expect(reference).not.toContain("Coût total")
    expect(receipt(d, null)).toBe(reference)
    expect(receipt(d, { available: false })).toBe(reference)
    expect(receipt(d, purchasesOf([PENDING]))).toBe(reference)
    expect(receipt(d, purchasesOf([PAID_1], { costTotal: null }))).toBe(reference)
    expect(renderToStaticMarkup(<CostTotalCard purchases={undefined} />)).toBe("")
  })

  it("coût total aberrant (achats nuls) : aucune carte", () => {
    const odd = purchasesOf([PAID_1], { costTotal: { service: 5000, purchasesPaid: 0, total: 5000 } })
    expect(renderToStaticMarkup(<CostTotalCard purchases={odd} />)).toBe("")
  })
})

describe("C11 achats payés en direct", () => {
  it("liste les demandes payées et reçues avec vendeur et montant, badge Hors EduCash, non remboursable", () => {
    const d = detailOf("done", purchasesOf([PAID_2, PAID_1, PENDING]))
    const out = text(renderToStaticMarkup(<PaidPurchasesCard estimate={15000} purchases={d.purchases} />))
    const flat = plain(out)
    expect(out).toContain('aria-label="Achats payés en direct"')
    expect(flat).toContain("Hors EduCash")
    expect(flat.indexOf("Ets Chez Maman Bénédicte")).toBeLessThan(flat.indexOf("Boutique Sœur Odile"))
    expect(flat).toMatch(num(7450))
    expect(flat).toMatch(num(6200))
    expect(flat).toContain("Reçu par le vendeur")
    expect(flat).toMatch(/Total payé par vous aux vendeurs\s+13[\s  ]650/)
    expect(flat).toMatch(/Estimation donnée à la publication\s+15[\s  ]000/)
    expect(flat).toContain("ne sont pas remboursables par EduCash")
    expect(flat).not.toContain("Pharmacie du Port")
  })

  it("une demande signalée n'est ni listée ni comptée, une ligne la mentionne", () => {
    const d = detailOf("done", purchasesOf([PAID_1, REPORTED]))
    const flat = plain(renderToStaticMarkup(<PaidPurchasesCard estimate={15000} purchases={d.purchases} />))
    expect(flat).not.toContain("Vendeur contesté")
    expect(flat).toMatch(/Signalés, non comptés\s+3[\s  ]000/)
    expect(flat).toMatch(/Total payé par vous aux vendeurs\s+7[\s  ]450/)
  })

  it("sans achat payé : DonePurchasesCard garde la carte existante, identique à PurchasesCard", () => {
    const withNone = renderToStaticMarkup(<DonePurchasesCard estimate={15000} escrowed purchases={purchasesOf([PENDING])} />)
    expect(withNone).toContain('aria-label="Achats pour votre compte"')
    expect(withNone).not.toContain("Achats payés en direct")
    expect(renderToStaticMarkup(<DonePurchasesCard estimate={15000} escrowed purchases={undefined} />)).toBe(
      renderToStaticMarkup(<DonePurchasesCard estimate={15000} escrowed purchases={{ available: false }} />),
    )
  })

  it("paidRequests : indisponible ou invalide donne une liste vide", () => {
    expect(paidRequests(undefined)).toEqual([])
    expect(paidRequests({ available: false })).toEqual([])
    expect(paidRequests({ available: true, requests: "x" })).toEqual([])
    expect(paidRequests(purchasesOf([PENDING, REPORTED]))).toEqual([])
  })
})

describe("C11 mission annulée", () => {
  it("achats payés : mentionnés hors EduCash, sans addition ni remboursement", () => {
    const d = detailOf("cancelled", purchasesOf([PAID_1, PAID_2]))
    const out = cancelled(d, d.purchases)
    const card = plain(section(out, "Achats payés en direct"))
    expect(card).toContain("Hors EduCash")
    expect(card).toMatch(num(7450))
    expect(card).toContain("EduCash ne peut pas les rembourser")
    expect(card).not.toMatch(num(13650))
    expect(out).not.toContain("Coût total")
    expect(plain(section(out, "Remboursement"))).toMatch(/Remboursé sur votre portefeuille\s+5[\s  ]000/)
  })

  it("rendu strictement inchangé sans achats payés", () => {
    const d = detailOf("cancelled")
    const reference = cancelled(d, undefined)
    expect(reference).not.toContain("Achats payés")
    expect(cancelled(d, { available: false })).toBe(reference)
    expect(cancelled(d, purchasesOf([PENDING, REPORTED]))).toBe(reference)
  })
})
