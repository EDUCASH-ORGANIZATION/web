// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { render, screen, within } from "@testing-library/react"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }))

const { MissionDetailView } = await import("./mission-detail-view")

const CLIENT = "11111111-1111-4111-8111-111111111111"
const STUDENT = "22222222-2222-4222-8222-222222222222"
const MISSION_ID = "33333333-3333-4333-8333-333333333333"
const REPORT_ID = "55555555-5555-4555-8555-555555555555"
const SIGNED = "https://proj.supabase.co/storage/v1/object/sign/purchase-proofs"

const request = (over = {}) => ({
  id: "66666666-6666-4666-8666-666666666666",
  seq: 1,
  number: "N° 1",
  status: "received",
  vendorName: "Étal de Maman Tossou",
  items: "Légumes",
  amount: 8750,
  payeeKind: "merchant",
  payeeNumber: "123456",
  payeePhotoUrl: `${SIGNED}/a/payee.jpg?token=t`,
  ticketPhotoUrl: `${SIGNED}/a/ticket.jpg?token=t`,
  smsPhotoUrl: `${SIGNED}/a/sms.jpg?token=t`,
  paidReference: "MP123",
  createdAt: "2026-10-12T12:10:00Z",
  editedAt: null,
  paidAt: "2026-10-12T12:24:00Z",
  receivedAt: "2026-10-12T12:31:00Z",
  reportedAt: null,
  cancelledAt: null,
  reports: [],
  ...over,
})

const totals = (over = {}) => ({ count: 1, requested: 8750, paid: 8750, pending: 0, reported: 0, estimate: 15000, ...over })

const data = (purchases) => ({
  today: "2026-10-15",
  mission: {
    id: MISSION_ID,
    title: "Courses au marché Dantokpa",
    description: "",
    type: "Livraison",
    city: "Cotonou",
    budget: 5000,
    urgency: "low",
    deadline: "2026-10-20",
    status: "in_progress",
    createdAt: "2026-10-10T08:00:00Z",
    updatedAt: "2026-10-12T08:00:00Z",
    clientId: CLIENT,
    selectedStudentId: STUDENT,
  },
  client: { id: CLIENT, name: "Rosine" },
  student: { id: STUDENT, name: "Koffi" },
  applications: { total: 0, items: [] },
  completion: { declaredAt: null, finishedAt: null },
  reviews: [],
  ledger: [{ id: "w1", userId: CLIENT, type: "reserve", amount: 5000, createdAt: "2026-10-10T08:01:00Z", party: "client" }],
  purchases,
})

const available = (items, over = {}) => ({
  available: true,
  estimate: 15000,
  reportsAvailable: true,
  items,
  totals: totals(),
  ...over,
})

const block = () => screen.getByRole("region", { name: /^Achats pour le compte du client/ })

describe("AD07 : achats pour le compte du client", () => {
  it("deux demandes : une carte chacune, trois preuves en images signées, note hors EduCash", () => {
    const second = request({
      id: "77777777-7777-4777-8777-777777777777",
      seq: 2,
      number: "N° 2",
      status: "pending",
      vendorName: "Boutique Saint-Michel",
      amount: 7500,
      smsPhotoUrl: null,
      paidAt: null,
      receivedAt: null,
      paidReference: null,
    })
    const { container } = render(
      <MissionDetailView
        data={data(available([request(), second], { totals: totals({ count: 2, requested: 16250, pending: 7500 }) }))}
      />,
    )
    const region = within(block())
    expect(region.getByText("2 demandes")).toBeTruthy()
    expect(region.getByText(/hors EduCash/, { selector: "b" })).toBeTruthy()
    expect(region.getByText(/ne peut pas les rembourser/)).toBeTruthy()

    const cards = container.querySelectorAll("article.ad-payreq")
    expect(cards).toHaveLength(2)
    expect(cards[0].querySelectorAll("img")).toHaveLength(3)
    expect(cards[1].querySelectorAll("img")).toHaveLength(2)
    for (const img of container.querySelectorAll("article img")) {
      expect(img.getAttribute("src")).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/sign\/purchase-proofs\//)
      expect(img.getAttribute("referrerpolicy")).toBe("no-referrer")
    }
    expect(within(cards[0]).getByText("Reçu par le vendeur")).toBeTruthy()
    expect(within(cards[0]).getByText("payé hors EduCash")).toBeTruthy()
    expect(within(cards[1]).getByText("En attente de paiement")).toBeTruthy()
    expect(within(cards[1]).getByText("à payer hors EduCash")).toBeTruthy()
    expect(within(cards[0]).getByText("123456")).toBeTruthy()
    expect(within(cards[0]).getByText("MP123")).toBeTruthy()
    expect(cards[0].className).not.toMatch(/is-flagged/)
  })

  it("preuve absente : tuile vide explicite, aucune image cassée, aucune image sans adresse", () => {
    const { container } = render(
      <MissionDetailView data={data(available([request({ status: "pending", smsPhotoUrl: null, ticketPhotoUrl: null })]))} />,
    )
    const card = container.querySelector("article.ad-payreq")
    expect(card.querySelectorAll("img")).toHaveLength(1)
    expect(card.querySelectorAll('img:not([src]), img[src=""]')).toHaveLength(0)
    expect(card.querySelectorAll(".ad-proof.is-missing")).toHaveLength(2)
    expect(within(card).getByRole("img", { name: "Capture du SMS : pas encore jointe" })).toBeTruthy()
    expect(within(card).getByRole("img", { name: "Ticket : indisponible" })).toBeTruthy()
  })

  it("demande signalée : filet rouge, signalement lié avec référence, motif, statut et lien vers le signalement", () => {
    const flagged = request({
      status: "reported",
      reportedAt: "2026-10-12T14:05:00Z",
      reports: [
        {
          id: REPORT_ID,
          reference: "SIG-0007",
          reason: "purchase_vendor_not_paid",
          status: "open",
          byRole: "student",
          createdAt: "2026-10-12T14:05:00Z",
        },
      ],
    })
    const { container } = render(
      <MissionDetailView data={data(available([flagged], { totals: totals({ paid: 0, reported: 8750 }) }))} />,
    )
    const card = container.querySelector("article.ad-payreq")
    expect(card.className).toMatch(/is-flagged/)
    expect(within(card).getByText("Signalé")).toBeTruthy()
    const link = within(card).getByRole("link", { name: "SIG-0007" })
    expect(link.getAttribute("href")).toBe(`/admin/reports/${REPORT_ID}`)
    expect(card.textContent).toContain("Le vendeur n'a pas reçu l'argent")
    expect(card.textContent).toContain("Ouvert")
    expect(card.textContent).toContain("par l'étudiant")
    expect(card.textContent).not.toContain("Signalements liés : aucun")
  })

  it("sans signalement : « Signalements liés : aucun » ; signalements illisibles : dit indisponibles", () => {
    const { container, unmount } = render(<MissionDetailView data={data(available([request()]))} />)
    expect(container.textContent).toContain("Signalements liés : aucun")
    unmount()
    const second = render(<MissionDetailView data={data(available([request()], { reportsAvailable: false }))} />)
    expect(second.container.textContent).toContain("Signalements liés : indisponibles")
  })

  it("totaux hors EduCash : payés en direct, en attente, estimation séparée, bloc Argent inchangé", () => {
    const { container } = render(
      <MissionDetailView
        data={data(available([request()], { totals: totals({ count: 2, requested: 16250, paid: 8750, pending: 7500 }) }))}
      />,
    )
    const recap = container.querySelector(".recap")
    const text = recap.textContent.replace(/\s/g, " ")
    expect(text).toMatch(/Estimation à la publication\s*15\s000\sFCFA/)
    expect(text).toMatch(/Payés en direct\s*8\s750\sFCFA/)
    expect(text).toMatch(/En attente de paiement\s*7\s500\sFCFA/)
    expect(text).toMatch(/indicatif et non encaissé\s*16\s250\sFCFA/)
    const money = screen.getByRole("region", { name: "Argent de la mission" })
    expect(money.textContent).not.toMatch(/16\s250|8\s750|15\s000/)
    expect(money.textContent).toMatch(/5\s000\sFCFA/)
  })

  it("aucun bouton ni action d'argent dans le bloc", () => {
    render(<MissionDetailView data={data(available([request()]))} />)
    const region = block()
    expect(region.querySelectorAll("button, form, input")).toHaveLength(0)
    expect(region.textContent).not.toMatch(/Rembours(er|ement) (forcé|maintenant)|Compenser|Suspendre/)
  })

  it("mission annoncée avec achats mais sans demande : on le dit", () => {
    render(<MissionDetailView data={data(available([], { totals: totals({ count: 0, requested: 0, paid: 0 }) }))} />)
    const region = within(block())
    expect(region.getByText("Aucune demande de paiement")).toBeTruthy()
    expect(region.getByText(/estimation 15\s000\sFCFA/)).toBeTruthy()
    expect(region.getByText("0 demande")).toBeTruthy()
  })

  it("mission sans achats ni estimation : bloc absent", () => {
    render(<MissionDetailView data={data(available([], { estimate: null }))} />)
    expect(screen.queryByRole("region", { name: /^Achats pour le compte du client/ })).toBeNull()
  })

  it("fonction indisponible (script 94 absent) : bloc masqué sans estimation, message avec estimation, aucune erreur", () => {
    const hidden = render(<MissionDetailView data={data({ available: false, reason: "missing", estimate: null })} />)
    expect(screen.queryByRole("region", { name: /^Achats pour le compte du client/ })).toBeNull()
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy()
    hidden.unmount()

    render(<MissionDetailView data={data({ available: false, reason: "missing", estimate: 9000 })} />)
    expect(block().textContent).toContain("ne sont pas disponibles pour le moment")
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("lecture en échec : le bloc le dit, la mission reste affichée", () => {
    render(<MissionDetailView data={data({ available: false, reason: "error", estimate: null })} />)
    expect(block().textContent).toContain("n'ont pas pu être chargées")
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Courses au marché Dantokpa")
  })

  it("données d'avant la tâche (sans purchases) : aucun bloc, aucune erreur", () => {
    render(<MissionDetailView data={data(undefined)} />)
    expect(screen.queryByRole("region", { name: /^Achats pour le compte du client/ })).toBeNull()
  })

  it("texte en vouvoiement, sans tiret cadratin", () => {
    const { container } = render(<MissionDetailView data={data(available([request()]))} />)
    expect(container.textContent).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    expect(container.textContent).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
  })
})
