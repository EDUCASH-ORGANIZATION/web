// Données de la planche C08 (mission en cours avec achats, cadre bureau 1 et mobile 1) : service 5 000 FCFA
// en séquestre, estimation d'achats 15 000 FCFA, étudiant Ulrich Zinsou. Vouvoiement, noms « Prénom N. » (A7).
// Aucune demande de paiement (décision 24 révisée) : seule l'estimation est une donnée réelle.
export const student = {
  id: "22222222-2222-4222-8222-222222222221",
  fullName: "Ulrich Zinsou",
  avatarUrl: null,
  city: "Cotonou",
  rating: 4.5,
  missionsDone: 7,
  isVerified: true,
  verifiedUntil: "2099-01-01",
  school: "UAC",
  level: "Licence 3 Anglais",
  skills: [],
}

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
    status: "in_progress",
    createdAt: "2026-10-09T07:40:00+01:00",
    selectedStudentId: student.id,
  },
  applications: [{ id: "a1", studentId: student.id, status: "accepted", message: null, createdAt: "2026-10-09T08:15:00+01:00", student }],
  selectedStudent: student,
  ledger: [{ type: "reserve", amount: 5000, createdAt: "2026-10-09T07:40:00+01:00" }],
  review: null,
}

export const screens = [
  {
    name: "c08",
    space: "c2",
    path: "/client/missions/11111111-1111-4111-8111-111111111111",
    view: "@/components/client-space/mission-detail/followup-view",
    component: "MissionFollowupView",
    props: { detail, flags: { confirmer: false, publiee: false, paymentsEnabled: true } },
  },
]
