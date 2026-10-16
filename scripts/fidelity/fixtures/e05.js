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
  application: { id: "a1", status: "accepted", message: "Bonjour", createdAt: "2026-10-07T09:00:00Z", updatedAt: "2026-10-09T08:00:00Z", acceptedAt: "2026-10-08T08:00:00Z" },
  isSelected: true,
  verification: null,
  ledger: [],
  review: null,
  similar: [],
}

// Titre de la planche mobile (cadre 1) : plus court que celui du bureau.
const mobile = { ...detail, mission: { ...detail.mission, title: "Courses du mois à Dantokpa" } }

// Cadre 0 de la planche : mission sans achats (Cours de maths, 25 000 FCFA, net 22 000 FCFA).
const plain = {
  ...detail,
  mission: {
    ...detail.mission,
    id: "m1",
    title: "Cours de maths niveau 3e, 2 soirs par semaine",
    type: "Cours particuliers",
    city: "Akpakpa, rue 6.112, Cotonou",
    budget: 25000,
    purchasesEstimate: null,
    deadline: "2999-10-22",
  },
  client: { name: "Rosine H.", avatarUrl: null, city: "Akpakpa", rating: 4.8, missionsPublished: 3, isVerified: true },
}
const plainMobile = { ...plain, mission: { ...plain.mission, title: "Cours de maths niveau 3e" } }

const flags = { postuler: false, paymentsEnabled: true }
const screen = (name, d) => ({
  name,
  space: "e2",
  path: "/student/missions/m2",
  view: "@/components/student-space/mission/followup-view",
  component: "MissionFollowupView",
  props: { detail: d, flags },
})

export const screens = [
  screen("e05", detail),
  screen("e05-m", mobile),
  screen("e05-0", plain),
  screen("e05-0m", plainMobile),
]
