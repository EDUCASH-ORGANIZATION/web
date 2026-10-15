// Données de la planche E07 (conversation étudiante, état « avec achats »). Service 8 000 FCFA,
// net 7 040 FCFA, achats estimés 7 450 FCFA. Vouvoiement (A6), noms « Prénom N. » (A7).
// Les champs budget, purchasesEstimate et net seront fournis par ST-02 ; avant, la vue les ignore.
import { NOW } from "./e06.js"

const msg = (i, mine, content, extra = {}) => ({
  id: `m${i}`,
  mine,
  type: "text",
  content,
  mediaUrl: null,
  lat: null,
  lng: null,
  createdAt: `2026-10-08T10:${String(30 + i).padStart(2, "0")}:00+01:00`,
  read: true,
  ...extra,
})

export const conversation = {
  userId: "u1",
  missionId: "m2",
  clientId: "c2",
  client: { id: "c2", name: "Afiavi D.", avatarUrl: null },
  mission: {
    title: "Courses du mois au marché Dantokpa",
    status: "in_progress",
    budget: 8000,
    purchasesEstimate: 7450,
    net: 7040,
  },
  state: "in_progress",
  canWrite: true,
  messages: [
    msg(0, true, "Je suis chez Tantie Awa, c'est réglé pour le riz. Je passe à la boutique pour l'huile."),
    msg(1, false, "Parfait, merci. Payé, la capture est jointe.", { read: false }),
    msg(2, true, "Bien reçu, je vous confirme à mon retour."),
  ],
}

export const screens = [
  {
    name: "e07",
    space: "e2",
    path: "/messages/m2",
    view: "@/components/student-space/messages/conversation-view",
    component: "StudentConversationView",
    props: { conversation, now: NOW },
  },
]
