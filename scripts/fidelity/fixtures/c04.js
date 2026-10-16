// Données de la planche C04 (mission ouverte, trois candidatures à examiner) : budget 8 000 FCFA bloqué à la
// publication le 6 octobre. Noms complets comme dans la planche ; la planche ne montre pas d'estimation d'achats
// sur C04, l'état « avec achats » est donc couvert par les tests de la vue et non par le banc.
const ID = "11111111-1111-4111-8111-111111111111"

const student = (n, over) => ({
  id: `22222222-2222-4222-8222-22222222222${n}`,
  avatarUrl: null,
  isVerified: true,
  verifiedUntil: "2099-06-30",
  skills: [],
  ...over,
})

const application = (n, over, studentOver) => ({
  id: `a-${n}`,
  studentId: `22222222-2222-4222-8222-22222222222${n}`,
  status: "pending",
  createdAt: "2026-10-07T21:40:00+01:00",
  student: student(n, studentOver),
  ...over,
})

export const detail = {
  mission: {
    id: ID,
    title: "Traduire un flyer en anglais",
    description: "Flyer A5 recto verso pour la Boutique Ayaba (environ 180 mots) à traduire en anglais pour un salon à Lagos.",
    type: "Traduction",
    city: "À distance",
    budget: 8000,
    urgency: "high",
    deadline: "2099-10-15",
    status: "open",
    createdAt: "2026-10-06T09:12:00+01:00",
    selectedStudentId: null,
    purchasesEstimate: null,
  },
  applications: [
    application(
      1,
      {
        message:
          "Bonjour Madame, je traduis déjà des supports pour une ONG de Cotonou. Je peux vous rendre le flyer en anglais sous 24 h, avec une relecture par une collègue anglophone. Je vous propose aussi deux variantes de slogan si le texte s'y prête.",
      },
      { fullName: "Afiavi Dossou", level: "Master 1 Lettres modernes", school: "UAC", city: "Cotonou", rating: 4.8, missionsDone: 14 },
    ),
    application(
      2,
      {
        createdAt: "2026-10-07T18:00:00+01:00",
        message: "Bonjour, étudiant en licence d'anglais, j'ai déjà traduit des menus et des affiches pour deux commerces d'Abomey-Calavi. Disponible dès ce soir.",
      },
      { fullName: "Ulrich Zinsou", level: "Licence 3 Anglais", school: "UAC", city: "Abomey-Calavi", rating: 4.5, missionsDone: 7 },
    ),
    application(
      3,
      {
        createdAt: "2026-10-07T12:00:00+01:00",
        message: "Bonsoir, je suis bilingue (scolarité au Nigeria). Ma carte étudiante est en cours d'examen. Je peux livrer avant le 12 octobre.",
      },
      { fullName: "Codjo Ahouansou", level: "Licence 3 Génie civil", school: "EPAC", city: "Abomey-Calavi", rating: 0, missionsDone: 0, isVerified: false },
    ),
  ],
  selectedStudent: null,
  ledger: [{ type: "reserve", amount: 8000, createdAt: "2026-10-06T09:12:00+01:00" }],
  review: null,
}

// Profil du tiroir C05 (candidate d'Afiavi, vérifiée) : avis lus côté serveur, l'auteur réduit à son prénom.
export const candidate = {
  studentId: "22222222-2222-4222-8222-222222222221",
  applicationId: "a-1",
  applicationStatus: "pending",
  message: detail.applications[0].message,
  appliedAt: "2026-10-06T18:12:00+01:00",
  student: {
    ...detail.applications[0].student,
    verifiedUntil: "2027-06-30",
    skills: ["Traduction", "Babysitting"],
  },
  reviewsTotal: 9,
  reviews: [
    { id: "r1", rating: 5, comment: "Traduction rendue en avance, très soignée. Elle a même corrigé deux fautes du texte d'origine.", createdAt: "2026-09-12T10:00:00+01:00", authorFirstName: "Association" },
    { id: "r2", rating: 5, comment: "Ponctuelle et rigoureuse sur la saisie, je la reprendrai.", createdAt: "2026-08-03T10:00:00+01:00", authorFirstName: "Cabinet" },
  ],
}

const noop = () => {}

export const screens = [
  {
    name: "c04",
    space: "c2",
    path: `/client/missions/${ID}`,
    view: "@/components/client-space/mission-detail/open-view",
    component: "MissionOpenView",
    props: { detail, candidate: null, flags: { confirmer: false, publiee: false, paymentsEnabled: true } },
  },
  {
    name: "c05",
    space: "c2",
    path: `/client/missions/${ID}`,
    view: "@/components/client-space/mission-detail/open/candidate-drawer",
    component: "CandidateDrawer",
    props: { open: true, candidate, missionId: ID, onClose: noop, onRetry: noop, onAccept: noop, onReject: noop },
  },
  {
    name: "c07",
    space: "c2",
    path: `/client/missions/${ID}`,
    view: "@/components/client-space/mission-detail/open/cancel-dialog",
    component: "CancelDialog",
    props: {
      open: true,
      mission: detail.mission,
      refundAmount: 8000,
      pendingNames: ["Afiavi", "Ulrich", "Codjo"],
      applicationsCount: 3,
      onClose: noop,
      onConfirm: noop,
    },
  },
]
