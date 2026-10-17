// Données de la planche C13 (conversation client, mission en cours avec achats) : service 5 000 FCFA
// en séquestre, achats estimés 7 450 FCFA. Vouvoiement, noms « Prénom N. » (A7).
// Contrat de ST-02 : conversation.relation ("selected" : étudiant retenu) et mission.{budget,
// purchasesEstimate}. Le client ne reçoit jamais le gain de l'étudiant (net).
// RD-ACHATS-01 (ST-11) : mission avec achats, deux demandes de paiement dans le fil comme la planche v2.1 : N° 1
// « Reçu par le vendeur » (7 450 FCFA, déjà payée en direct) et N° 2 « En attente » (6 200 FCFA, numéro MoMo personnel).
// Adresses de photos absentes : la vue rend « Photo indisponible » (aucune image réseau dans le banc).
// RD-DONE-01 : completionAvailable / completionDeclaredAt (fin déclarée par l'étudiant). L'écran « c13 » n'est pas
// déclaré (rendu de la planche) ; l'écran « c13-declared » l'est (bandeau « À confirmer »). La planche C13 v2 n'a
// aucun cadre « fin à confirmer » : cet écran est rendu par le banc mais n'est pas mesuré (aucune spec).
import { CONVERSATIONS, NOW } from "./c12.js"

const R1 = "6f1c2a52-8f3e-4c1d-9a55-0d3b6e4a7c10"
const R2 = "7a2d3b63-9a4f-4d2e-8b66-1e4c7f5b8d21"

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
  relation: "selected",
  state: "in_progress",
  canWrite: true,
  completionAvailable: true,
  completionDeclaredAt: null,
  purchasesAvailable: true,
  purchaseRequests: [
    {
      id: R1,
      seq: 1,
      status: "received",
      version: 4,
      amount: 7450,
      vendorName: "Ets Chez Maman Bénédicte",
      items: "Légumes, piment, poisson fumé",
      payeeKind: "merchant",
      payeeNumber: "452187",
      payeePhotoUrl: null,
      ticketPhotoUrl: null,
      smsPhotoUrl: null,
      createdAt: "2026-10-10T10:42:00+01:00",
      editedAt: null,
      paidAt: "2026-10-10T10:51:00+01:00",
      receivedAt: "2026-10-10T10:56:00+01:00",
      paidReference: "MP-0436-1",
      alreadyReportedByMe: false,
      reportReason: null,
      reportReference: null,
      reviewed: false,
    },
    {
      id: R2,
      seq: 2,
      status: "pending",
      version: 1,
      amount: 6200,
      vendorName: "Boutique Sœur Odile",
      items: "Riz 5 kg, huile, savon",
      payeeKind: "personal",
      payeeNumber: "+2290196421841",
      payeePhotoUrl: null,
      ticketPhotoUrl: null,
      smsPhotoUrl: null,
      createdAt: "2026-10-10T11:15:00+01:00",
      editedAt: null,
      paidAt: null,
      receivedAt: null,
      paidReference: null,
      alreadyReportedByMe: false,
      reportReason: null,
      reportReference: null,
      reviewed: false,
    },
  ],
  messages: [
    msg(0, false, "Bonjour Madame, je suis à Dantokpa. Je commence par les légumes chez Maman Bénédicte."),
    msg(1, false, "Demande de paiement", { type: "purchase_request", purchaseRequestId: R1 }),
    msg(2, true, "C'est payé, merci Ulrich. Capture envoyée."),
    msg(3, false, "Ulrich confirme : Ets Chez Maman Bénédicte a reçu 7 450 FCFA.", { type: "purchase_event", purchaseRequestId: R1 }),
    msg(4, false, "Pour le riz et l'huile, Sœur Odile n'a pas de numéro marchand : je vous envoie son numéro personnel.", { read: false }),
    msg(5, false, "Demande de paiement", { type: "purchase_request", purchaseRequestId: R2, read: false }),
  ],
}

// La conversation est rendue dans les deux volets de la messagerie (layout de client/messages/) : la vue de la boîte
// reçoit la liste de la planche C12 et la conversation en volet de droite (`child`).
export const screens = [
  {
    name: "c13",
    space: "c2",
    path: "/client/messages/11111111-1111-4111-8111-111111111111",
    view: "@/components/client-space/messages/inbox-view",
    component: "ClientInboxView",
    props: { result: { conversations: CONVERSATIONS }, now: NOW },
    child: {
      view: "@/components/client-space/messages/conversation-view",
      component: "ConversationView",
      props: { conversation, now: NOW, paymentsEnabled: true },
    },
  },
  {
    name: "c13-declared",
    space: "c2",
    path: "/client/messages/11111111-1111-4111-8111-111111111111",
    view: "@/components/client-space/messages/inbox-view",
    component: "ClientInboxView",
    props: { result: { conversations: CONVERSATIONS }, now: NOW },
    child: {
      view: "@/components/client-space/messages/conversation-view",
      component: "ConversationView",
      props: {
        conversation: { ...conversation, completionDeclaredAt: "2026-10-12T09:30:00+01:00" },
        now: NOW,
        paymentsEnabled: true,
      },
    },
  },
]
