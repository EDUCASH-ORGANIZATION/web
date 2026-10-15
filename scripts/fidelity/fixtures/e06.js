// Données de la planche E06 (messagerie étudiante) : mêmes noms, titres et heures, vouvoiement (A6)
// et noms au format « Prénom N. » (A7). Jeudi 8 octobre 2026, 14 h 32.
export const NOW = "2026-10-08T14:32:00+01:00"

const conv = (over) => ({
  key: "k",
  missionId: "m1",
  name: "Rosine H.",
  avatarUrl: null,
  missionTitle: "Cours de maths niveau 3e",
  state: "in_progress",
  preview: "C'est bien rue 6.112 ce soir à 18:00 ?",
  lastAt: "2026-10-08T13:28:00+01:00",
  unreadCount: 0,
  ...over,
})

export const CONVERSATIONS = [
  conv({ key: "m1:c1", missionId: "m1", unreadCount: 1 }),
  conv({ key: "m2:c2", missionId: "m2", name: "Afiavi D.", missionTitle: "Courses du mois à Dantokpa", preview: "Payé, la capture est jointe.", lastAt: "2026-10-08T11:02:00+01:00", unreadCount: 1 }),
  conv({ key: "m3:c3", missionId: "m3", name: "Cabinet A.", missionTitle: "Saisie de 200 fiches", preview: "Vous : Fichier Excel envoyé.", lastAt: "2026-10-07T16:00:00+01:00" }),
  conv({ key: "m4:c4", missionId: "m4", name: "Mawuli A.", missionTitle: "Animer la page Facebook", state: "candidate", preview: "Avez-vous des exemples de publications ?", lastAt: "2026-10-07T09:00:00+01:00" }),
  conv({ key: "m5:c5", missionId: "m5", name: "Nadège K.", missionTitle: "Livraison de colis", preview: "Nadège vous a retenue.", lastAt: "2026-10-07T08:00:00+01:00" }),
  conv({ key: "m6:c6", missionId: "m6", name: "Association B.", missionTitle: "Traduction d'un flyer", state: "done", preview: "Merci pour la traduction !", lastAt: "2026-10-06T10:00:00+01:00" }),
]

export const screens = [
  {
    name: "e06",
    space: "e2",
    path: "/messages",
    view: "@/components/student-space/messages/inbox-view",
    component: "StudentInboxView",
    props: { result: { conversations: CONVERSATIONS }, now: NOW },
  },
]
