// Données de la planche E05 (mission retenue, suivi, état « avec achats »). Service 8 000 FCFA, net 7 040 FCFA,
// achats estimés 45 000 FCFA, trois demandes de paiement d'achats (reçue, payée, en attente) payées en direct par le
// client, hors séquestre (lecteur de RD-ACHATS-01, `detail.purchases`). Vouvoiement (A6), noms « Prénom N. » (A7).
const request = (n, over) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, seq: n, status: "pending", version: 1, items: null, actions: {}, ...over,
})
const purchases = {
  available: true,
  requests: [
    request(1, { status: "received", vendorName: "Tantie Awa", items: "céréales", amount: 21500, sentAt: "2026-10-08T09:10:00Z", paidAt: "2026-10-08T09:20:00Z", receivedAt: "2026-10-08T09:24:00Z" }),
    request(2, { status: "paid", vendorName: "Boutique Chez Codjo", amount: 12750, sentAt: "2026-10-08T09:41:00Z", paidAt: "2026-10-08T10:02:00Z", actions: { confirmReceived: true } }),
    request(3, { status: "pending", vendorName: "Poissonnerie Dossa", amount: 6000, sentAt: "2026-10-08T10:05:00Z" }),
  ],
  totals: { count: 3, requested: 40250, paid: 34250, pending: 6000, reported: 0 },
  exceedsEstimate: false,
  canCreate: true,
}

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
  // Colonne de déclaration disponible, fin non déclarée (RD-DONE-01 : carte « Vous avez fini ? », barre mobile).
  completion: { available: true, declaredAt: null },
  purchases,
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
  purchases: { available: false },
  client: { name: "Rosine H.", avatarUrl: null, city: "Akpakpa", rating: 4.8, missionsPublished: 3, isVerified: true },
}
const plainMobile = { ...plain, mission: { ...plain.mission, title: "Cours de maths niveau 3e" } }

// Cadre « Après » de la planche : fin déclarée (le 14 octobre), état « À confirmer » sans bouton.
const declared = { ...plainMobile, completion: { available: true, declaredAt: "2026-10-14T14:32:00Z" } }

const flags = { postuler: false, terminer: false, paymentsEnabled: true }
const screen = (name, d, f = flags) => ({
  name,
  space: "e2",
  path: "/student/missions/m2",
  view: "@/components/student-space/mission/followup-view",
  component: "MissionFollowupView",
  props: { detail: d, flags: f },
})

export const screens = [
  screen("e05", detail),
  screen("e05-m", mobile),
  screen("e05-0", plain),
  screen("e05-0m", plainMobile),
  // Bureau, modale « J'ai terminé » ouverte par ?terminer=1 (cadre 2 de la planche).
  screen("e05-t", plain, { ...flags, terminer: true }),
  // Mobile, après la déclaration : « À confirmer » (cadre 2 de la planche).
  screen("e05-c", declared),
]
