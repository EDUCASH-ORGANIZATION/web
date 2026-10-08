import { COMMISSION_RATE, netAmount } from "@/lib/constants/missions"
import { MIN_DEPOSIT_AMOUNT } from "@/lib/supabase/database.constants"

// Budget de l'exemple chiffré (illustration, pas une donnée de la base).
export const EXAMPLE_BUDGET = 25000

export const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)
export const STUDENT_PERCENT = 100 - COMMISSION_PERCENT

export const MIN_BUDGET = MIN_DEPOSIT_AMOUNT

export const EXAMPLE_NET = netAmount(EXAMPLE_BUDGET)
export const EXAMPLE_COMMISSION = EXAMPLE_BUDGET - EXAMPLE_NET

// Icône et exemples par type de mission (maquette V05). « Autre » est exclu de la grille.
export const TYPE_CARDS = [
  { type: "Cours particuliers", icon: "i-book", shape: "sh-burst", variant: "v-cat--big", square: "", example: "Maths, anglais, physique, préparation au BEPC et au BAC." },
  { type: "Livraison", icon: "i-bike", shape: "sh-circle", variant: "", square: "ic-sq--givre", example: "Colis, courses, documents en zem ou à pied." },
  { type: "Saisie", icon: "i-keyboard", shape: "sh-quarter", variant: "v-cat--encre", square: "", example: "Excel, fiches clients, transcription." },
  { type: "Babysitting", icon: "i-baby", shape: "sh-heart", variant: "v-cat--citron", square: "ic-sq--encre", example: "Garde après l'école, sorties, soirées." },
  { type: "Traduction", icon: "i-languages", shape: "sh-tri", variant: "", square: "ic-sq--givre", example: "Français, anglais, fongbé, yoruba." },
  { type: "Community Management", icon: "i-megaphone", shape: "sh-star", variant: "v-cat--lavande", square: "ic-sq--blanc", example: "Page Facebook, visuels, publications." },
]

// Garanties. Textes issus de la maquette V05 : règles cibles, voir la question Q5 du plan RD-01.
export const GUARANTEES = [
  { icon: "i-undo", shape: "sh-half", variant: "v05-g--bleu", square: "", title: "Remboursé si vous annulez", text: "Tant qu'aucun étudiant n'est retenu, l'annulation est libre et le budget revient tout de suite sur votre portefeuille." },
  { icon: "i-scale", shape: "sh-burst", variant: "v05-g--citron", square: "ic-sq--blanc", title: "Un souci ? On fait la médiation", text: "Un souci pendant la mission ? Contactez l'équipe EduCash depuis la page Contact : nous intervenons en médiation." },
  { icon: "i-id-card", shape: "sh-quarter", variant: "v05-g--encre", square: "", title: "Des cartes vérifiées à la main", text: "Chaque carte étudiante est contrôlée par l'équipe. Le badge vaut un an, puis il doit être renouvelé." },
  { icon: "i-check-circle", shape: "sh-star", variant: "v05-g--lavande", square: "ic-sq--blanc", title: "Vous validez avant de payer", text: "L'argent ne part que quand vous confirmez la fin de la mission." },
]

// FAQ client. Les réponses sont des données sérialisables (texte seul, le gras est rendu à part).
export const FAQ_ITEMS = [
  {
    id: "etudiant-absent",
    question: "Que se passe-t-il si l'étudiant ne vient pas ?",
    answer: "Tant que vous n'avez pas validé la mission, votre budget reste bloqué et rien n'est versé à l'étudiant. Un souci ? Contactez l'équipe EduCash depuis la page Contact : nous intervenons en médiation.",
  },
  {
    id: "achats",
    question: "Une mission avec des courses : qui paie les achats ?",
    answer: "Vous, directement au vendeur, par MoMo. L'étudiant vous envoie dans la conversation la photo du numéro marchand, le montant et le ticket. Vous payez le vendeur directement par MoMo et vous lui envoyez la capture du SMS. Seul son service passe par le séquestre.",
    warning: "Vérifiez toujours le nom du bénéficiaire affiché par MoMo.",
  },
  {
    id: "choisir-etudiant",
    question: "Comment choisir le bon étudiant ?",
    answer: "Lisez les candidatures et les profils : le badge de vérification, le parcours, les missions déjà réalisées et le message de présentation. Vous pouvez discuter avec chaque candidat avant de retenir celui qui vous convient.",
  },
  {
    id: "argent-non-utilise",
    question: "Puis-je récupérer l'argent non utilisé ?",
    answer: "Oui. Seul le budget d'une mission est bloqué. Si vous annulez avant de retenir un étudiant, il revient aussitôt sur votre portefeuille EduCash.",
  },
]
