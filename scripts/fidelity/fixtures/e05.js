// Données de la planche E05 (mission retenue, suivi, état « avec achats »). Service 8 000 FCFA, net 7 040 FCFA,
// achats estimés 45 000 FCFA. Vouvoiement (A6), noms « Prénom N. » (A7).
const detail = {
  state: "selected",
  mission: {
    id: "m2",
    title: "Courses du mois au marché Dantokpa, livrées à Cadjèhoun",
    description: "Courses du mois.",
    type: "Livraison",
    city: "Dantokpa puis Cadjèhoun",
    budget: 8000,
    purchasesEstimate: 45000,
    urgency: "low",
    deadline: "2999-10-10",
    status: "in_progress",
    createdAt: "2026-10-07T08:00:00Z",
  },
  client: { name: "Afiavi D.", avatarUrl: null, city: "Cadjèhoun", rating: 4.6, missionsPublished: 5, isVerified: true },
  application: { id: "a1", status: "accepted", message: "Bonjour", createdAt: "2026-10-07T09:00:00Z", updatedAt: "2026-10-08T08:00:00Z" },
  isSelected: true,
  verification: null,
  ledger: [],
  review: null,
  similar: [],
}

export const screens = [
  {
    name: "e05",
    space: "e2",
    path: "/student/missions/m2",
    view: "@/components/student-space/mission/followup-view",
    component: "MissionFollowupView",
    props: { detail, flags: { postuler: false, paymentsEnabled: true } },
  },
]
