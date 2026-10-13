// Logique pure des composants interactifs de app-ui (aucun accès au DOM ni à React).

// Seuil de la feuille du bas et de l'en-tête mobile : strictement sous 1024 px.
export const COMPACT_MEDIA_QUERY = "(max-width: 1023.98px)"

// Espace fine insécable entre les milliers (les montants restent sur une seule ligne).
const THIN_NBSP = " "
export const AMOUNT_MAX_DIGITS = 9

// Index du radio à activer selon la touche (groupe APG : flèches bouclent, Début et Fin sautent).
// Renvoie -1 quand la touche ne déplace rien.
export function nextRadioIndex(count, at, key) {
  if (count <= 0) return -1
  const from = at < 0 || at >= count ? 0 : at
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (from + 1) % count
    case "ArrowLeft":
    case "ArrowUp":
      return (from - 1 + count) % count
    case "Home":
      return 0
    case "End":
      return count - 1
    default:
      return -1
  }
}

// Valeur suivante d'un groupe d'étoiles (1 à max) : borné, sans bouclage. Renvoie null si la touche est sans effet.
export function nextStarValue(value, key, max = 5) {
  const current = Number.isInteger(value) && value >= 1 && value <= max ? value : 0
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(max, current + 1)
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(1, current - 1)
    case "Home":
      return 1
    case "End":
      return max
    default:
      return null
  }
}

// Chiffres seuls, bornés à AMOUNT_MAX_DIGITS, sans zéros de tête.
export function sanitizeAmountDigits(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, AMOUNT_MAX_DIGITS)
  return digits.replace(/^0+(?=\d)/, "")
}

// "12500" -> "12 500" (espace fine insécable) ; vide si aucun chiffre.
export function formatAmountInput(raw) {
  const digits = sanitizeAmountDigits(raw)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_NBSP)
}

// Entier saisi, ou null quand le champ est vide.
export function parseAmountInput(raw) {
  const digits = sanitizeAmountDigits(raw)
  return digits === "" ? null : Number(digits)
}

// Le rouge plein n'existe qu'en ton "danger" et à la dernière étape.
export function confirmStepView({ step, totalSteps, tone }) {
  const isLast = step >= totalSteps - 1
  return { isLast, danger: tone === "danger" && isLast }
}

// Défilement horizontal restant à droite (signal de l'indice dans les onglets).
export function hasMoreToScroll({ scrollWidth, scrollLeft, clientWidth }, slack = 4) {
  return scrollWidth - clientWidth - scrollLeft > slack
}

// Pile de toasts : les plus anciens sont retirés quand le plafond est dépassé.
export const TOAST_MAX = 3

export function addToast(list, toast, max = TOAST_MAX) {
  return [...list, toast].slice(-max)
}

export function removeToast(list, id) {
  return list.filter((t) => t.id !== id)
}

// Durée d'affichage : une erreur reste plus longtemps à l'écran.
export function toastDuration(variant, duration) {
  if (typeof duration === "number") return duration
  return variant === "error" ? 8000 : 5000
}
