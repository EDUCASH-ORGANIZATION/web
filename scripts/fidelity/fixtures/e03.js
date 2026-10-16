// Données de la planche E03 (détail de mission et candidature, état « avec achats »). Service 8 000 FCFA,
// net 7 040 FCFA, achats estimés 45 000 FCFA. Vouvoiement (A6), noms « Prénom N. » (A7).
// Aucun nombre de candidats : l'étudiant ne lit que sa propre candidature (confidentialité), la planche montre « 3 candidats ».
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
  },
  client: { name: "Afiavi D.", avatarUrl: null, city: "Cadjèhoun", rating: 4.7, missionsPublished: 5, isVerified: true },
  application: null,
  isSelected: false,
  verification: { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: null, action: null },
  ledger: [],
  review: null,
  similar: [],
}

// Cadre 0 de la planche : mission sans achats (Cours de physique, 20 000 FCFA, net 17 600 FCFA).
const plain = {
  ...detail,
  mission: {
    ...detail.mission,
    id: "m1",
    title: "Cours de physique niveau 1re, le mercredi",
    description:
      "Ma fille est en 1re D au CEG Gbégamey. Elle a besoin d'aide en électricité et en mécanique avant les compositions du premier trimestre. Une séance de 2 h chaque mercredi de 15:00 à 17:00, chez nous à Cadjèhoun, pendant 4 semaines.",
    type: "Cours particuliers",
    city: "Cadjèhoun, Cotonou",
    budget: 20000,
    purchasesEstimate: null,
    deadline: "2999-10-30",
    createdAt: "2026-10-06T08:00:00Z",
  },
  client: { name: "Mawuli A.", avatarUrl: null, city: "Cotonou", rating: 4.7, missionsPublished: 5, isVerified: true },
  similar: [
    { id: "s1", title: "Cours d'anglais niveau 6e", type: "Cours particuliers", city: "Godomey", budget: 15000 },
    { id: "s2", title: "Soutien en maths, classe de 4e", type: "Cours particuliers", city: "Akpakpa", budget: 12000 },
  ],
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
  {
    name: "e03-0",
    space: "e2",
    path: "/student/missions/m1",
    view: "@/components/student-space/mission/apply-view",
    component: "MissionApplyView",
    props: { detail: plain, flags: { postuler: false, paymentsEnabled: true } },
  },
]
