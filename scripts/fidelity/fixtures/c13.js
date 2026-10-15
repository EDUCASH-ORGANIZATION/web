// Données de la planche C13 (conversation client, mission en cours avec achats) : service 5 000 FCFA
// en séquestre, achats estimés 7 450 FCFA. Vouvoiement, noms « Prénom N. » (A7).
// Les champs budget et purchasesEstimate seront fournis par ST-02 ; avant, la vue les ignore.
import { NOW } from "./c12.js"

const msg = (i, mine, content, extra = {}) => ({
  id: `m${i}`,
  mine,
  type: "text",
  content,
  mediaUrl: null,
  lat: null,
  lng: null,
  createdAt: `2026-10-10T10:${String(30 + i).padStart(2, "0")}:00+01:00`,
  read: true,
  ...extra,
})

export const conversation = {
  userId: "client-1",
  missionId: "11111111-1111-4111-8111-111111111111",
  studentId: "22222222-2222-4222-8222-222222222221",
  student: { id: "22222222-2222-4222-8222-222222222221", name: "Ulrich Z.", avatarUrl: null },
  mission: {
    title: "Courses au marché Dantokpa",
    status: "in_progress",
    budget: 5000,
    purchasesEstimate: 7450,
  },
  state: "in_progress",
  canWrite: true,
  messages: [
    msg(0, false, "Bonjour Madame, je suis à Dantokpa. Je commence par les légumes chez Maman Bénédicte."),
    msg(1, true, "Très bien, merci Ulrich. Tenez-moi au courant."),
    msg(2, false, "Je vous envoie le ticket dans un instant.", { read: false }),
  ],
}

export const screens = [
  {
    name: "c13",
    space: "c2",
    path: "/client/messages/11111111-1111-4111-8111-111111111111",
    view: "@/components/client-space/messages/conversation-view",
    component: "ConversationView",
    props: { conversation, now: NOW },
  },
]
