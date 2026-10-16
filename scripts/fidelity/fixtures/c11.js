// Données de la planche C11 (mission terminée avec achats, non notée, cadre bureau 1 et mobile 1) : service
// 5 000 FCFA libéré (commission 600, versé 4 400), estimation d'achats 15 000 FCFA, étudiant Ulrich Zinsou.
// Vouvoiement, noms « Prénom N. » (A7). Les achats payés en direct (13 650 FCFA) ne sont pas une donnée : seule
// l'estimation est lue.
import { student } from "./c08.js"

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
