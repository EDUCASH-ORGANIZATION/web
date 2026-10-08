// Contenu de la page /aide. Données sérialisables (utilisables côté serveur et côté client).
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"

const COMMISSION_PCT = Math.round(COMMISSION_RATE * 100)
const NET_PCT = 100 - COMMISSION_PCT
const MIN_WITHDRAWAL = `${MIN_WITHDRAWAL_AMOUNT.toLocaleString("fr-FR").replace(/\s/g, " ")} FCFA`

/** Avertissement affiché avant tout paiement d'achats (décision 24), repris à l'identique. */
export const PAYMENT_WARNING =
  "Vérifiez le nom du bénéficiaire affiché par MoMo avant de payer. EduCash n'intervient pas dans ce paiement."

/**
 * Thèmes de l'aide. Un item peut porter des étapes (`steps`) et un avertissement (`notice`),
 * rendus après le premier paragraphe de `answer` pour les étapes, et en fin de réponse pour l'avertissement.
 * @type {Array<{ id: string, title: string, icon: string, items: Array<{ id: string, question: string, answer: string[], steps?: Array<{ title: string, text: string }>, notice?: string, links?: Array<{ href: string, label: string }> }> }>}
 */
export const AIDE_THEMES = [
  {
    id: "sequestre",
    title: "Séquestre et paiement",
    icon: "i-lock",
    items: [
      {
        id: "paye",
        question: "Quand est-ce que je suis payé ?",
        answer: [
          "Le client paie à l'avance : son budget est bloqué en séquestre dès la publication de la mission. Il ne bouge plus jusqu'à la fin.",
          "Quand tu déclares « J'ai terminé », le client confirme. S'il ne répond pas, la libération est automatique 72 h plus tard. Ton gain arrive alors sur ton portefeuille EduCash, d'où tu peux le retirer vers MoMo.",
        ],
      },
      {
        id: "achats",
        question: "Mission avec achats : qui paie les courses ?",
        answer: [
          "Le client, directement au vendeur. Jamais toi, et jamais par EduCash : l'argent des achats ne transite pas par la plateforme, seul le service passe par le séquestre. Tout se passe dans la conversation de la mission.",
          "Pourquoi ce choix ? Par transparence et par honnêteté. Chaque franc des achats va droit à celui qui vend, le ticket fait foi, et personne n'avance d'argent pour l'autre. L'estimation des achats donnée sur la mission est indicative : elle ne bloque aucun fonds et ne porte aucune commission. Seul ton service passe par le séquestre, et la commission de " +
            `${COMMISSION_PCT} % ne porte que sur lui : EduCash ne gagne rien sur les courses.`,
        ],
        steps: [
          {
            title: "Tu envoies une demande de paiement",
            text: "Dans la conversation : photo du numéro marchand, montant exact et ticket.",
          },
          {
            title: "Le client paie le vendeur par MoMo",
            text: "Directement, hors EduCash. Il marque la demande « Payé » avec la capture du SMS.",
          },
          {
            title: "Tu confirmes la réception",
            text: "Le vendeur te remet les achats, tu confirmes. Tu n'avances jamais d'argent.",
          },
        ],
        notice: PAYMENT_WARNING,
      },
      {
        id: "commission",
        question: "Combien prend EduCash ?",
        answer: [
          `Une commission unique de ${COMMISSION_PCT} %, prélevée sur le paiement de l'étudiant. Tu encaisses donc ${NET_PCT} % du budget de la mission : sur 25 000 FCFA, 22 000 FCFA arrivent sur ton portefeuille.`,
          "Le client ne paie aucun frais en plus du budget qu'il a fixé.",
        ],
      },
      {
        id: "annulation",
        question: "Le client peut-il annuler après m'avoir retenu ?",
        answer: [
          "Si la mission est annulée, le budget bloqué est remboursé au client. Tant que tu n'as pas terminé, rien ne t'est versé et rien ne t'est prélevé.",
          "En cas de désaccord, signale-le depuis la mission : l'équipe EduCash examine la situation.",
        ],
      },
      {
        id: "litige",
        question: "Que se passe-t-il en cas de problème pendant la mission ?",
        answer: [
          "Le client ou toi pouvez le signaler depuis la mission. La libération automatique est alors suspendue et l'équipe tranche : remboursement, paiement partiel ou paiement total.",
        ],
      },
    ],
  },
  {
    id: "retraits",
    title: "Retraits",
    icon: "i-banknote",
    items: [
      {
        id: "retrait-momo",
        question: "Comment retirer mes gains sur MoMo ?",
        answer: [
          "Depuis ton portefeuille, choisis « Retirer », saisis le montant et le numéro Mobile Money qui doit recevoir l'argent (MTN MoMo ou Moov Money), puis valide.",
          `Le retrait est possible dès ${MIN_WITHDRAWAL}.`,
        ],
      },
      {
        id: "retrait-minimum",
        question: "Y a-t-il un montant minimum pour retirer ?",
        answer: [`Oui : ${MIN_WITHDRAWAL}. En dessous, ton gain reste sur ton portefeuille et s'additionne aux suivants.`],
      },
      {
        id: "retrait-echec",
        question: "Mon retrait a échoué, que faire ?",
        answer: [
          "Vérifie d'abord le numéro saisi. Si un retrait échoue, contacte-nous depuis la page Contact en précisant la date et le montant : l'équipe vérifie l'opération avec FedaPay.",
        ],
        links: [{ href: "/contact", label: "Nous contacter" }],
      },
      {
        id: "retrait-operateurs",
        question: "Quels opérateurs sont acceptés ?",
        answer: ["Les paiements passent par FedaPay, avec MTN MoMo et Moov Money."],
      },
    ],
  },
  {
    id: "verification",
    title: "Vérification",
    icon: "i-id-card",
    items: [
      {
        id: "carte-pourquoi",
        question: "Pourquoi envoyer ma carte étudiante ?",
        answer: [
          "Pour prouver que tu es bien étudiant. La vérification rassure les clients et te donne le badge « Vérifié » sur ton profil.",
        ],
      },
      {
        id: "carte-envoi",
        question: "Comment envoyer ma carte ?",
        answer: [
          "Depuis ton profil, ouvre la vérification et envoie une photo nette de ta carte, bien éclairée, sans flou, avec toutes les informations lisibles.",
        ],
      },
      {
        id: "carte-refusee",
        question: "Ma carte a été refusée, que faire ?",
        answer: [
          "Le motif du refus est indiqué sur ton profil. Reprends une photo plus nette ou plus complète et renvoie-la.",
          "Si tu penses à une erreur, écris-nous.",
        ],
        links: [{ href: "/contact", label: "Nous contacter" }],
      },
      {
        id: "carte-validite",
        question: "Le badge « Vérifié » expire-t-il ?",
        answer: ["Oui, il est valable un an. Passé ce délai, renvoie ta carte pour le renouveler."],
      },
    ],
  },
  {
    id: "missions",
    title: "Missions",
    icon: "i-briefcase",
    items: [
      {
        id: "mission-trouver",
        question: "Comment trouver une mission ?",
        answer: ["Parcours les missions ouvertes, puis filtre par type, ville et budget."],
        links: [{ href: "/missions", label: "Voir les missions" }],
      },
      {
        id: "mission-postuler",
        question: "Comment postuler ?",
        answer: [
          "Ouvre la mission et utilise le bouton « Postuler ». Il faut un compte étudiant, et une carte vérifiée peut t'être demandée.",
        ],
      },
      {
        id: "mission-choix",
        question: "Qui choisit l'étudiant ?",
        answer: ["Le client. Il reçoit les candidatures, les compare et accepte celle qu'il préfère."],
      },
      {
        id: "mission-types",
        question: "Quels types de missions existent ?",
        answer: [
          "Des petits services du quotidien : courses, garde d'enfants, saisie, traduction, cours particuliers, communication et bien d'autres.",
        ],
      },
      {
        id: "mission-villes",
        question: "Dans quelles villes ?",
        answer: ["À Cotonou, Abomey-Calavi et Porto-Novo."],
      },
      {
        id: "mission-publier",
        question: "Comment publier une mission en tant que client ?",
        answer: [
          "Créez un compte client, décrivez la mission, fixez le budget, puis publiez. Le budget est bloqué en séquestre jusqu'à la fin du travail.",
        ],
        links: [{ href: "/clients", label: "Pour les clients" }],
      },
    ],
  },
  {
    id: "compte",
    title: "Compte",
    icon: "i-user",
    items: [
      {
        id: "compte-creer",
        question: "Comment créer un compte ?",
        answer: ["Inscris-toi en choisissant ton rôle, étudiant ou client, puis confirme ton adresse e-mail."],
        links: [{ href: "/auth/register", label: "Créer un compte" }],
      },
      {
        id: "compte-connexion",
        question: "Je n'arrive pas à me connecter",
        answer: [
          "Vérifie ton adresse e-mail et ton mot de passe, et que tu as bien confirmé ton e-mail à l'inscription. Sinon, écris-nous.",
        ],
        links: [{ href: "/auth/login", label: "Se connecter" }],
      },
      {
        id: "compte-supprimer",
        question: "Comment supprimer mon compte ?",
        answer: ["Écris-nous depuis la page de contact, nous traiterons ta demande."],
        links: [{ href: "/contact", label: "Nous contacter" }],
      },
    ],
  },
]

/** Questions les plus lues, affichées sous la recherche. */
export const POPULAR_QUESTIONS = [
  { id: "paye", label: "Quand suis-je payé ?" },
  { id: "retrait-momo", label: "Retirer sur MoMo" },
  { id: "carte-refusee", label: "Carte refusée" },
  { id: "achats", label: "Mission avec achats" },
]

/** Étapes du séquestre, avec le montant net calculé sur la commission réelle. */
export const ESCROW_STEPS = [
  {
    title: "Le client recharge",
    text: "Son portefeuille EduCash, par MTN MoMo ou Moov Money via FedaPay.",
  },
  {
    title: "Le budget est bloqué",
    text: "À la publication, le budget passe en séquestre. Il ne bouge plus jusqu'à la fin.",
    tone: "bleu",
  },
  {
    title: "Tu termines, il confirme",
    text: "Tu déclares « J'ai terminé ». Il confirme, ou c'est automatique 72 h plus tard.",
  },
  {
    title: `Tu encaisses ${NET_PCT} %`,
    text: `Les 22 000 FCFA sur 25 000 arrivent sur ton portefeuille. Retrait vers MoMo dès ${MIN_WITHDRAWAL}.`,
    tone: "citron",
  },
]
