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
  completion: { available: true, declaredAt: null },
}

// Planche C09 (modale « Confirmer la fin », cadre bureau 0 et mobile 0) : mission sans achats, 15 000 FCFA bloqués
// depuis le 1 oct., étudiante Nadège Kpadonou. La modale s'ouvre par le drapeau confirmer (sans action).
const nadege = {
  ...student,
  id: "22222222-2222-4222-8222-222222222223",
  fullName: "Nadège Kpadonou",
  rating: 4.7,
  missionsDone: 9,
  school: "ENEAM",
  level: "Licence 2 Gestion",
}

export const detailC09 = {
  mission: {
    ...detail.mission,
    title: "Saisie de 200 fiches clients",
    type: "Saisie",
    city: null,
    budget: 15000,
    purchasesEstimate: null,
    deadline: "2026-10-09",
    createdAt: "2026-10-01T11:05:00+01:00",
    selectedStudentId: nadege.id,
  },
  applications: [],
  selectedStudent: nadege,
  ledger: [{ type: "reserve", amount: 15000, createdAt: "2026-10-01T11:05:00+01:00" }],
  review: null,
  completion: { available: true, declaredAt: null },
}

// Planche C08 v2 (cadre bureau 2, travail déclaré) : même mission que C09, fin déclarée le 7 oct. à 10:00.
// Le livrable joint de la planche n'est pas une donnée de l'application (messagerie) : il n'est pas rendu.
export const detailC08c = {
  ...detailC09,
  completion: { available: true, declaredAt: "2026-10-07T10:00:00+01:00" },
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
  {
    name: "c08c",
    space: "c2",
    path: "/client/missions/11111111-1111-4111-8111-111111111111",
    view: "@/components/client-space/mission-detail/followup-view",
    component: "MissionFollowupView",
    props: { detail: detailC08c, flags: { confirmer: false, publiee: false, paymentsEnabled: true } },
  },
  {
    name: "c09",
    space: "c2",
    path: "/client/missions/11111111-1111-4111-8111-111111111111",
    view: "@/components/client-space/mission-detail/followup-view",
    component: "MissionFollowupView",
    props: { detail: detailC09, flags: { confirmer: true, publiee: false, paymentsEnabled: true } },
  },
]
