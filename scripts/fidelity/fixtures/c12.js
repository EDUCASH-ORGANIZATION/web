// Données de la planche C12 (messagerie client) : cinq conversations, deux non lues.
// Vouvoiement, noms « Prénom N. » (A7). Jeudi 8 octobre 2026, 14 h 32.
export const NOW = "2026-10-08T14:32:00+01:00"
const M = (n) => `11111111-1111-4111-8111-11111111111${n}`
const S = (n) => `22222222-2222-4222-8222-22222222222${n}`

const conv = (over) => ({
  key: "k",
  missionId: M(1),
  studentId: S(1),
  name: "Ulrich Z.",
  avatarUrl: null,
  missionTitle: "Courses au marché Dantokpa",
  state: "in_progress",
  preview: "Demande de paiement : 6 200 FCFA",
  lastAt: "2026-10-08T11:15:00+01:00",
  unreadCount: 0,
  ...over,
})

export const CONVERSATIONS = [
  conv({ key: `${M(1)}:${S(1)}`, unreadCount: 1 }),
  conv({ key: `${M(2)}:${S(2)}`, missionId: M(2), studentId: S(2), name: "Afiavi D.", missionTitle: "Traduire un flyer en anglais", state: "candidate", preview: "Oui, je peux vous envoyer un essai de slogan.", lastAt: "2026-10-08T10:48:00+01:00" }),
  conv({ key: `${M(3)}:${S(3)}`, missionId: M(3), studentId: S(3), name: "Sèna A.", missionTitle: "Cours de maths niveau 3e", preview: "Vous : À ce soir 18 h, merci Sèna.", lastAt: "2026-10-08T09:30:00+01:00" }),
  conv({ key: `${M(4)}:${S(4)}`, missionId: M(4), studentId: S(4), name: "Nadège K.", missionTitle: "Saisie de 200 fiches", preview: "J'ai envoyé fiches-clients.xlsx, tout est vérifié.", lastAt: "2026-10-07T16:00:00+01:00", unreadCount: 1 }),
  conv({ key: `${M(2)}:${S(5)}`, missionId: M(2), studentId: S(5), name: "Codjo A.", missionTitle: "Traduire un flyer en anglais", state: "candidate", preview: "Vous : Bonjour Codjo, avez-vous déjà traduit des supports ?", lastAt: "2026-10-06T10:00:00+01:00" }),
]

export const screens = [
  {
    name: "c12",
    space: "c2",
    path: "/client/messages",
    view: "@/components/client-space/messages/inbox-view",
    component: "InboxView",
    props: { result: { conversations: CONVERSATIONS }, now: NOW },
  },
]
