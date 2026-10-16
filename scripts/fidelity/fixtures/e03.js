// Données de la planche E03 (détail de mission et candidature, état « avec achats »). Service 8 000 FCFA,
// net 7 040 FCFA, achats estimés 45 000 FCFA. Vouvoiement (A6), noms « Prénom N. » (A7).
const detail = {
  state: "open",
  mission: {
    id: "m2",
    title: "Courses du mois au marché Dantokpa, livrées à Cadjèhoun",
    description:
      "Je vous confie ma liste de courses du mois : riz, huile, savon, poisson fumé. Achetez au marché Dantokpa et livrez chez moi à Cadjèhoun avant 13:00. Je paie chaque vendeur moi-même par MoMo, vous n'avancez rien.",
    type: "Livraison",
    city: "Dantokpa puis Cadjèhoun, Cotonou",
    budget: 8000,
    purchasesEstimate: 45000,
    urgency: "low",
    deadline: "2999-10-10",
    status: "open",
    createdAt: "2026-10-07T08:00:00Z",
    applicationsCount: 3,
  },
  client: { name: "Afiavi D.", avatarUrl: null, city: "Cadjèhoun", rating: 4.7, missionsPublished: 5, isVerified: true },
  application: null,
  isSelected: false,
  verification: { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: null, action: null },
  ledger: [],
  review: null,
  similar: [],
}

export const screens = [
  {
    name: "e03",
    space: "e2",
    path: "/student/missions/m2",
    view: "@/components/student-space/mission/apply-view",
    component: "MissionApplyView",
    props: { detail, flags: { postuler: false, paymentsEnabled: true } },
  },
]
