// Données de la planche E07 (conversation étudiante, état « avec achats »). Service 8 000 FCFA,
// net 7 040 FCFA, achats estimés 7 450 FCFA. Vouvoiement (A6), noms « Prénom N. » (A7).
// La conversation porte la demande N° 2 « Payé » de la planche (carte `purchase_request`, ligne système `purchase_event`)
// et autorise le bouton ticket du composeur (`purchasesAvailable`, `purchaseCanCreate`).
import { CONVERSATIONS, NOW } from "./e06.js"

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

const REQUEST_ID = "4a1c2b3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"

// Demande N° 2 de la planche : numéro MoMo personnel, marquée « Payé » par la cliente à 11:02, envoyée à 10:41.
const REQUEST = {
  id: REQUEST_ID,
  seq: 2,
  status: "paid",
  version: 2,
  amount: 12750,
  vendorName: "Boutique Chez Codjo",
  items: "Huile 5 L, savon, sucre",
  payeeKind: "personal",
  payeeNumber: "+2290197001122",
  payeePhotoUrl: null,
  ticketPhotoUrl: null,
  smsPhotoUrl: null,
  payeePhotoPath: "u1/4a1c2b3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/payee-fidelity01.jpg",
  ticketPhotoPath: "u1/4a1c2b3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/ticket-fidelity01.jpg",
  sentAt: "2026-10-08T10:41:00+01:00",
  paidAt: "2026-10-08T11:02:00+01:00",
  alreadyReportedByMe: false,
}

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
  completionAvailable: true,
  completionDeclaredAt: null,
  canWrite: true,
  purchasesAvailable: true,
  purchaseCanCreate: true,
  purchaseRequests: [REQUEST],
  purchaseTotals: { count: 1, requested: 12750, paid: 12750, pending: 0, reported: 0 },
  messages: [
    msg(0, true, "Je suis chez Tantie Awa, c'est réglé pour le riz. Je passe à la boutique pour l'huile."),
    msg(1, true, "Demande de paiement d'achats N° 2", {
      type: "purchase_request",
      purchaseRequestId: REQUEST_ID,
      createdAt: "2026-10-08T10:41:00+01:00",
      read: false,
    }),
    msg(2, false, "La demande N° 2 est marquée « Payé ».", {
      type: "purchase_event",
      purchaseRequestId: REQUEST_ID,
      createdAt: "2026-10-08T11:02:00+01:00",
    }),
    msg(3, false, "Payé, la capture est jointe. Vérifiez avec Codjo svp.", {
      read: false,
      createdAt: "2026-10-08T11:02:00+01:00",
    }),
  ],
}

// Cadre mobile « Cartes Reçu par le vendeur et En attente de paiement » de la planche : demande N° 1 reçue (confirmation
// de l'étudiant à 11:09) puis demande N° 3 en attente, envoyée à 11:05. Les photos sont des vignettes d'icônes (aucune
// adresse signée dans la planche).
const ID_1 = "4b1c2b3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
const ID_3 = "4c1c2b3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
const base = { version: 1, payeePhotoUrl: null, ticketPhotoUrl: null, smsPhotoUrl: null, alreadyReportedByMe: false }
export const conversationAchats = {
  ...conversation,
  purchaseRequests: [
    {
      ...base,
      id: ID_1,
      seq: 1,
      status: "received",
      version: 3,
      amount: 21500,
      vendorName: "Tantie Awa · céréales",
      items: "Riz 25 kg, maïs 5 kg",
      payeeKind: "merchant",
      payeeNumber: "4521",
      payeePhotoPath: `u1/${ID_1}/payee-fidelity01.jpg`,
      ticketPhotoPath: `u1/${ID_1}/ticket-fidelity01.jpg`,
      sentAt: "2026-10-08T10:12:00+01:00",
      paidAt: "2026-10-08T10:50:00+01:00",
      receivedAt: "2026-10-08T11:09:00+01:00",
    },
    {
      ...base,
      id: ID_3,
      seq: 3,
      status: "pending",
      amount: 6000,
      vendorName: "Poissonnerie Dossa",
      items: "Poisson fumé, crevettes",
      payeeKind: "merchant",
      payeeNumber: "4522",
      payeePhotoPath: `u1/${ID_3}/payee-fidelity01.jpg`,
      ticketPhotoPath: `u1/${ID_3}/ticket-fidelity01.jpg`,
      sentAt: "2026-10-08T11:05:00+01:00",
    },
  ],
  messages: [
    msg(0, true, "Demande de paiement d'achats N° 1", {
      type: "purchase_request",
      purchaseRequestId: ID_1,
      createdAt: "2026-10-08T10:12:00+01:00",
    }),
    msg(1, true, "Le vendeur a bien reçu le paiement de la demande N° 1.", {
      type: "purchase_event",
      purchaseRequestId: ID_1,
      createdAt: "2026-10-08T11:09:00+01:00",
    }),
    msg(2, true, "Demande de paiement d'achats N° 3", {
      type: "purchase_request",
      purchaseRequestId: ID_3,
      createdAt: "2026-10-08T11:05:00+01:00",
    }),
  ],
}

// La conversation est rendue dans les deux volets de la messagerie (layout de messages/) : la vue de la boîte
// reçoit la liste de la planche E06 et la conversation en volet de droite (`child`).
export const screens = [
  {
    name: "e07",
    space: "e2",
    path: "/messages/m2",
    view: "@/components/student-space/messages/inbox-view",
    component: "StudentInboxView",
    props: { result: { conversations: CONVERSATIONS }, now: NOW },
    child: {
      view: "@/components/student-space/messages/conversation-view",
      component: "StudentConversationView",
      props: { conversation, now: NOW, paymentsEnabled: true },
    },
  },
  {
    name: "e07-achats",
    space: "e2",
    path: "/messages/m2",
    view: "@/components/student-space/messages/inbox-view",
    component: "StudentInboxView",
    props: { result: { conversations: CONVERSATIONS }, now: NOW },
    child: {
      view: "@/components/student-space/messages/conversation-view",
      component: "StudentConversationView",
      props: { conversation: conversationAchats, now: NOW, paymentsEnabled: true },
    },
  },
]
