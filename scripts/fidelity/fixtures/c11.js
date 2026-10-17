// Données de la planche C11 (mission terminée avec achats, non notée, cadre bureau 1 et mobile 1) : service
// 5 000 FCFA libéré (commission 600, versé 4 400), estimation d'achats 15 000 FCFA, étudiant Ulrich Zinsou.
// Vouvoiement, noms « Prénom N. » (A7). Les achats payés en direct (2 demandes reçues, 13 650 FCFA) viennent de
// `detail.purchases` (lecteur de RD-ACHATS-01) : ils ne sont ni libérés ni remboursés par EduCash, hors séquestre.
import { student } from "./c08.js"

const requests = [
  {
    id: "p1", seq: 1, status: "received", amount: 7450, vendorName: "Ets Chez Maman Bénédicte",
    items: "Légumes, piment, poisson fumé", payeeKind: "merchant", payeeNumber: "452187",
  },
  {
    id: "p2", seq: 2, status: "received", amount: 6200, vendorName: "Boutique Sœur Odile",
    items: "Riz 5 kg, huile, savon", payeeKind: "phone", payeeNumber: "+22901964218",
  },
]

export const detail = {
  mission: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Courses au marché Dantokpa",
    description: "Courses au marché.",
    type: "Livraison",
    city: "Dantokpa puis Cadjèhoun",
    budget: 5000,
    purchasesEstimate: 15000,
    urgency: "low",
    deadline: "2026-10-10",
    status: "done",
    createdAt: "2026-10-09T07:40:00+01:00",
    selectedStudentId: student.id,
  },
  applications: [{ id: "a1", studentId: student.id, status: "accepted", message: null, createdAt: "2026-10-09T17:40:00+01:00", student }],
  selectedStudent: student,
  ledger: [
    { type: "reserve", amount: 5000, createdAt: "2026-10-09T07:40:00+01:00" },
    { type: "release", amount: 5000, createdAt: "2026-10-10T13:05:00+01:00" },
    { type: "commission", amount: 600, createdAt: "2026-10-10T13:05:00+01:00" },
  ],
  review: null,
  purchases: {
    available: true,
    requests,
    totals: { count: 2, requested: 13650, paid: 13650, pending: 0, reported: 0 },
    exceedsEstimate: false,
    confirmWarning: { show: false, pending: 0, reported: 0 },
    costTotal: { service: 5000, purchasesPaid: 13650, total: 18650 },
  },
}

export const screens = [
  {
    name: "c11",
    space: "c2",
    path: "/client/missions/11111111-1111-4111-8111-111111111111",
    view: "@/components/client-space/mission-detail/followup-view",
    component: "MissionFollowupView",
    props: { detail, flags: { confirmer: false, publiee: false, paymentsEnabled: true } },
  },
]
