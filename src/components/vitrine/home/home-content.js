import { COMMISSION_RATE, netAmount } from "@/lib/constants/missions"
import { MIN_DEPOSIT_AMOUNT } from "@/lib/supabase/database.constants"
import { formatFcfa } from "@/lib/vitrine/format"

// Budget de l'exemple chiffré (illustration, pas une donnée de la base).
export const EXAMPLE_BUDGET = 25000

export const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

export const MIN_BUDGET = MIN_DEPOSIT_AMOUNT

export const EXAMPLE_NET = netAmount(EXAMPLE_BUDGET)
export const EXAMPLE_COMMISSION = EXAMPLE_BUDGET - EXAMPLE_NET

// Garanties de la section Confiance. Aucun délai promis, médiation via la page Contact.
export const GUARANTEES = [
  { icon: "i-lock", shape: "sh-half", variant: "v05-g--bleu", square: "", title: "Payé seulement quand vous validez", text: "Votre budget est bloqué à la publication. Il ne part à l'étudiant que quand vous confirmez la fin de la mission." },
  { icon: "i-id-card", shape: "sh-burst", variant: "v05-g--citron", square: "ic-sq--blanc", title: "Des cartes vérifiées à la main", text: "Chaque carte étudiante est contrôlée par l'équipe. Le badge vaut un an, puis il doit être renouvelé." },
  { icon: "i-scale", shape: "sh-quarter", variant: "v05-g--encre", square: "", title: "Un souci ? On fait la médiation", text: "Un souci pendant la mission ? Contactez l'équipe EduCash depuis la page Contact : nous intervenons en médiation." },
  { icon: "i-undo", shape: "sh-star", variant: "v05-g--lavande", square: "ic-sq--blanc", title: "Remboursé si vous annulez", text: "Tant qu'aucun étudiant n'est retenu, l'annulation est libre et le budget revient tout de suite sur votre portefeuille." },
]

// FAQ clients (5 questions). Les réponses sont des données sérialisables ; `warning` est rendu en gras.
export const FAQ_ITEMS = [
  {
    id: "serieux",
    question: "Comment savoir si l'étudiant est sérieux ?",
    answer: "Chaque étudiant envoie sa carte étudiante, contrôlée à la main par l'équipe EduCash. Sur son profil, vous voyez son badge, son établissement, les missions déjà réalisées et les avis d'autres clients. Vous pouvez discuter avec chaque candidat avant de le retenir.",
  },
  {
    id: "mission-difficile",
    question: "Et si la mission se passe mal ?",
    answer: "Tant que vous n'avez pas validé la mission, votre budget reste bloqué et rien n'est versé à l'étudiant. Un souci ? Contactez l'équipe EduCash depuis la page Contact : nous intervenons en médiation.",
  },
  {
    id: "cout",
    question: "Combien ça coûte ?",
    answer: `Vous fixez le budget de la mission, à partir de ${formatFcfa(MIN_BUDGET)}. La commission EduCash de ${COMMISSION_PERCENT} % est incluse dans ce budget et rien ne s'ajoute. Exemple : pour ${formatFcfa(EXAMPLE_BUDGET)}, l'étudiant touche ${formatFcfa(EXAMPLE_NET)} et la commission est de ${formatFcfa(EXAMPLE_COMMISSION)}. Pas d'abonnement, pas de frais d'inscription.`,
  },
  {
    id: "achats-marche",
    question: "Pour le marché, qui paie les achats ?",
    answer: "Vous, directement au vendeur, par MoMo. L'étudiant vous envoie dans la conversation la photo du numéro marchand, le montant et le ticket. Vous payez le vendeur et vous lui envoyez la capture du SMS. Seul le service de l'étudiant passe par le séquestre.",
    warning: "Vérifiez toujours le nom du bénéficiaire affiché par MoMo.",
  },
  {
    id: "entreprise",
    question: "Puis-je publier au nom de mon entreprise ?",
    answer: "Oui, c'est le même compte et le même parcours que pour une famille. Décrivez la mission, fixez le budget et payez à la validation. Chaque paiement est tracé dans votre portefeuille EduCash : mission, montant, commission, date.",
  },
]
