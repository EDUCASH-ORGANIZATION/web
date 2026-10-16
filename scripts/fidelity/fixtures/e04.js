// Données de la planche E04 (Mes candidatures étudiant, onglet « En attente »). Jeudi 8 octobre 2026, 14 h 32.
// Vouvoiement (A6) et noms « Prénom N. » (A7). Candidature retenue la veille à 17 h 40.
const NOW = "2026-10-08T14:32:00+01:00"

const row = (over) => ({
  id: "a1",
  missionId: "m1",
  title: "Animer la page Facebook d'une boutique",
  type: "Community Management",
  city: "Haie Vive, Cotonou",
  budget: 40000,
  net: 35200,
  deadline: "2026-10-31",
  missionStatus: "open",
  status: "pending",
  appliedAt: "2026-10-06T09:00:00+01:00",
  updatedAt: "2026-10-06T09:00:00+01:00",
  clientName: "Mawuli A.",
  clientFirst: "Mawuli",
  review: null,
  ...over,
})

export const DATA = {
  tab: "en-attente",
  counts: { "en-attente": 3, "en-cours": 3, terminees: 23, "non-retenues": 4 },
  total: 33,
  rows: [
    row(),
    row({ id: "a2", missionId: "m2", title: "Garde de deux enfants samedi soir", type: "Babysitting", city: "Godomey", budget: 12000, net: 10560, deadline: "2026-10-10", clientName: "Ulrich Z.", clientFirst: "Ulrich", appliedAt: "2026-10-06T10:00:00+01:00" }),
    row({ id: "a3", missionId: "m3", title: "Saisie d'un mémoire de 60 pages", type: "Saisie", city: "Abomey-Calavi", budget: 10000, net: 8800, deadline: "2026-10-24", clientName: "Koffi H.", clientFirst: "Koffi", appliedAt: "2026-10-03T10:00:00+01:00" }),
  ],
  escrow: { total: 5280, count: 1 },
  highlight: {
    missionId: "m9",
    title: "Livraison de colis au marché Dantokpa",
    city: "Ganhi",
    deadline: "2026-10-09",
    net: 5280,
    clientName: "Nadège K.",
    clientFirst: "Nadège",
    acceptedAt: "2026-10-07T17:40:00+01:00",
  },
}

export const screens = [
  {
    name: "e04",
    space: "e2",
    path: "/applications",
    view: "@/components/student-space/applications/applications-view",
    component: "StudentApplicationsView",
    props: { result: { data: DATA }, unreadByMission: { m1: { at: "2026-10-08T09:12:00+01:00", state: "candidate" } }, now: NOW, paymentsEnabled: true },
  },
]
