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
        question: "Quand suis-je payé ?",
        answer: [
          "Le client paie à l'avance : son budget est bloqué en séquestre dès la publication de la mission. Il ne bouge plus jusqu'à la fin.",
          "Une fois la mission faite, le client confirme et votre argent arrive sur votre portefeuille EduCash, d'où vous pouvez le retirer vers MoMo.",
        ],
      },
      {
        id: "achats",
        question: "Mission avec achats : qui paie les achats ?",
        answer: [
          "Le client, directement au vendeur. Jamais vous, et jamais par EduCash : l'argent des achats ne transite pas par la plateforme, seul le service passe par le séquestre. Tout se passe dans la conversation de la mission.",
          "Pourquoi ce choix ? Par transparence et par honnêteté. Chaque franc des achats va droit à celui qui vend, le ticket fait foi, et personne n'avance d'argent pour l'autre. L'estimation des achats donnée sur la mission est indicative : elle ne bloque aucun fonds et ne porte aucune commission. Seul votre service passe par le séquestre, et la commission de " +
            `${COMMISSION_PCT} % ne porte que sur lui : EduCash ne gagne rien sur les achats.`,
        ],
        steps: [
          {
            title: "Vous envoyez les infos du vendeur",
            text: "Dans la conversation : la photo du numéro marchand, le montant exact et le ticket.",
          },
          {
            title: "Le client paie le vendeur par MoMo",
            text: "Directement, hors EduCash. Il vous envoie la capture du SMS.",
          },
          {
            title: "Vous confirmez le paiement au client",
            text: "Vous confirmez au client que le vendeur a bien reçu le paiement. Vous n'avancez jamais d'argent.",
          },
        ],
        notice: PAYMENT_WARNING,
      },
      {
        id: "commission",
        question: "Combien prend EduCash ?",
        answer: [
          `Une commission unique de ${COMMISSION_PCT} %, prélevée sur le paiement de l'étudiant. Vous encaissez donc ${NET_PCT} % du budget de la mission : sur 25 000 FCFA, 22 000 FCFA arrivent sur votre portefeuille.`,
          "Le client ne paie aucun frais en plus du budget qu'il a fixé.",
        ],
      },
      {
        id: "annulation",
        question: "Le client peut-il annuler après m'avoir retenu ?",
        answer: [
          "Si la mission est annulée, le budget bloqué est remboursé au client. Tant que vous n'avez pas terminé, rien ne vous est versé et rien ne vous est prélevé.",
          "En cas de désaccord, contactez l'équipe EduCash depuis la page Contact : nous intervenons en médiation.",
        ],
      },
      {
        id: "litige",
        question: "Que se passe-t-il en cas de problème pendant la mission ?",
        answer: [
          "Un souci pendant la mission ? Contactez l'équipe EduCash depuis la page Contact : nous intervenons en médiation.",
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
          "Depuis votre portefeuille, choisissez « Retirer », saisissez le montant et le numéro Mobile Money qui doit recevoir l'argent (MTN MoMo ou Moov Money), puis validez.",
          `Le retrait est possible dès ${MIN_WITHDRAWAL}.`,
        ],
      },
      {
        id: "retrait-minimum",
        question: "Y a-t-il un montant minimum pour retirer ?",
        answer: [`Oui : ${MIN_WITHDRAWAL}. En dessous, votre gain reste sur votre portefeuille et s'additionne aux suivants.`],
      },
      {
        id: "retrait-echec",
        question: "Mon retrait a échoué, que faire ?",
        answer: [
          "Vérifiez d'abord le numéro saisi. Si un retrait échoue, contactez-nous depuis la page Contact en précisant la date et le montant : l'équipe vérifie l'opération avec notre prestataire de paiement.",
        ],
        links: [{ href: "/contact", label: "Nous contacter" }],
      },
      {
        id: "retrait-operateurs",
        question: "Quels opérateurs sont acceptés ?",
        answer: ["Les paiements passent par MTN MoMo, Moov Money et Celtiis Cash."],
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
          "Pour prouver que vous êtes bien étudiant. La vérification rassure les clients et vous donne le badge « Vérifié » sur votre profil.",
        ],
      },
      {
        id: "carte-envoi",
        question: "Comment envoyer ma carte ?",
        answer: [
          "Depuis votre profil, ouvrez la vérification et envoyez une photo nette de votre carte, bien éclairée, sans flou, avec toutes les informations lisibles.",
        ],
      },
      {
        id: "carte-refusee",
        question: "Ma carte a été refusée, que faire ?",
        answer: [
          "Le motif du refus est indiqué sur votre profil. Reprenez une photo plus nette ou plus complète et renvoyez-la.",
          "Si vous pensez à une erreur, écrivez-nous.",
        ],
        links: [{ href: "/contact", label: "Nous contacter" }],
      },
      {
        id: "carte-validite",
        question: "Le badge « Vérifié » expire-t-il ?",
        answer: ["Oui, il est valable un an. Passé ce délai, renvoyez votre carte pour le renouveler."],
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
        answer: ["Parcourez les missions ouvertes, puis filtrez par type, ville et budget."],
        links: [{ href: "/missions", label: "Voir les missions" }],
      },
      {
        id: "mission-postuler",
        question: "Comment postuler ?",
        answer: [
          "Ouvrez la mission et utilisez le bouton « Postuler ». Il faut un compte étudiant, et une carte vérifiée peut vous être demandée.",
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
          "Des petits services du quotidien : marché et achats, démarches et files d'attente, garde d'enfants, travaux sur ordinateur, traduction, cours et aide aux devoirs, réseaux sociaux et bien d'autres.",
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
        links: [{ href: "/", label: "Publier une mission" }],
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
        answer: ["Inscrivez-vous en choisissant votre rôle, étudiant ou client, puis confirmez votre adresse e-mail."],
        links: [{ href: "/auth/register", label: "Créer un compte" }],
      },
      {
        id: "compte-connexion",
        question: "Je n'arrive pas à me connecter",
        answer: [
          "Vérifiez votre adresse e-mail et votre mot de passe, et que vous avez bien confirmé votre e-mail à l'inscription. Sinon, écrivez-nous.",
        ],
        links: [{ href: "/auth/login", label: "Se connecter" }],
      },
      {
        id: "compte-supprimer",
        question: "Comment supprimer mon compte ?",
        answer: ["Écrivez-nous depuis la page de contact, nous traiterons votre demande."],
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
    text: "Son portefeuille EduCash, par MTN MoMo ou Moov Money.",
  },
  {
    title: "Le budget est bloqué",
    text: "À la publication, le budget passe en séquestre. Il ne bouge plus jusqu'à la fin.",
    tone: "bleu",
  },
  {
    title: "Vous terminez, il confirme",
    text: "Une fois la mission faite, le client confirme et votre argent arrive sur votre portefeuille EduCash.",
  },
  {
    title: `Vous encaissez ${NET_PCT} %`,
    text: `Les 22 000 FCFA sur 25 000 arrivent sur votre portefeuille. Retrait vers MoMo dès ${MIN_WITHDRAWAL}.`,
    tone: "citron",
  },
]
