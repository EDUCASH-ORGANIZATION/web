// Logique pure du formulaire de demande de paiement d'achats (RD-ACHATS-01 ST-05) : champs obligatoires, erreurs
// sous les champs, valeur à envoyer, envoi unique. Les règles de format viennent de `@/lib/purchases/requests` :
// rien n'est redéfini ici hors les messages de champ manquant. Aucun accès aux données.
import {
  ITEMS_MAX,
  VENDOR_NAME_MAX,
  VENDOR_NAME_MIN,
  exceedsEstimate,
  parsePayeeNumber,
  parsePurchaseAmount,
} from "@/lib/purchases/requests"

/** Champs obligatoires, dans l'ordre de la feuille. */
export const REQUIRED_FIELDS = ["payeePhoto", "payeeNumber", "vendorName", "amount", "ticketPhoto"]

export const MISSING_COPY = {
  payeePhoto: "Ajoutez la photo du numéro marchand ou du panneau.",
  payeeNumber: "Indiquez le numéro à payer.",
  vendorName: "Indiquez le nom du vendeur.",
  amount: "Indiquez le montant total du ticket.",
  ticketPhoto: "Ajoutez la photo du ticket ou des articles.",
}

export const SEND_FALLBACK_ERROR = "La demande n'a pas été envoyée. Vérifiez votre connexion, vos informations sont conservées."

const squeeze = (text) => (typeof text === "string" ? text.replace(/\s+/gu, " ").trim() : "")

/** Un champ obligatoire est-il renseigné ? (présence seulement : le format est contrôlé par `validateForm`.) */
export function isFilled(field, values) {
  switch (field) {
    case "payeePhoto":
    case "ticketPhoto":
      return Boolean(values?.[field]?.path)
    case "payeeNumber":
    case "vendorName":
      return squeeze(values?.[field]) !== ""
    case "amount":
      return Number.isFinite(values?.amount)
    default:
      return false
  }
}

/** Champs obligatoires encore vides. */
export function missingFields(values) {
  return REQUIRED_FIELDS.filter((field) => !isFilled(field, values))
}

/**
 * Contrôle complet. `errors` : message par champ (manquant ou invalide). `data` : valeur à envoyer au serveur
 * (numéro et montant normalisés, textes nettoyés), ou null s'il reste une erreur.
 * @param {{ payeeKind?: string, payeeNumber?: string, vendorName?: string, items?: string, amount?: number|null,
 *   payeePhoto?: { path?: string }|null, ticketPhoto?: { path?: string }|null }} values
 */
export function validateForm(values) {
  const errors = {}
  for (const field of missingFields(values)) errors[field] = MISSING_COPY[field]

  let payeeNumber = ""
  if (!errors.payeeNumber) {
    const parsed = parsePayeeNumber(values.payeeNumber, values.payeeKind)
    if (parsed.ok) payeeNumber = parsed.value
    else errors.payeeNumber = parsed.error
  }

  const vendorName = squeeze(values?.vendorName)
  if (!errors.vendorName && (vendorName.length < VENDOR_NAME_MIN || vendorName.length > VENDOR_NAME_MAX)) {
    errors.vendorName = `Le nom du vendeur compte de ${VENDOR_NAME_MIN} à ${VENDOR_NAME_MAX} caractères.`
  }

  const items = squeeze(values?.items)
  if (items.length > ITEMS_MAX) errors.items = `Les articles comptent ${ITEMS_MAX} caractères au plus.`

  let amount = null
  if (!errors.amount) {
    const parsed = parsePurchaseAmount(values.amount)
    if (parsed.ok) amount = parsed.value
    else errors.amount = parsed.error
  }

  if (Object.keys(errors).length > 0) return { errors, data: null }
  return {
    errors,
    data: {
      payeeKind: values.payeeKind,
      payeeNumber,
      payeePhotoPath: values.payeePhoto.path,
      vendorName,
      items,
      amount,
      ticketPhotoPath: values.ticketPhoto.path,
    },
  }
}

/** Avertissement non bloquant : le total des demandes (celle-ci comprise) dépasse largement l'estimation. */
export function showsEstimateWarning({ amount, otherRequested = 0, estimate }) {
  const parsed = parsePurchaseAmount(amount)
  if (!parsed.ok) return false
  return exceedsEstimate({ requested: (Number.isFinite(otherRequested) ? otherRequested : 0) + parsed.value, estimate })
}

/**
 * Envoi unique : le verrou `guard` ({ current }) est posé de façon synchrone, un second clic avant le rendu suivant
 * est ignoré. Il reste posé après un succès (la fenêtre se ferme) et il est libéré après une erreur.
 * Renvoie { skipped: true } ou le résultat de `run` ({ error } si `run` échoue ou lève).
 * @param {{ current: boolean }} guard
 * @param {() => Promise<{ error?: string }|undefined>} run
 * @param {string} fallbackError
 */
export async function runOnce(guard, run, fallbackError) {
  if (guard.current) return { skipped: true }
  guard.current = true
  try {
    const result = (await run()) ?? {}
    if (result.error || result.fieldErrors) guard.current = false
    return result
  } catch {
    guard.current = false
    return { error: fallbackError }
  }
}
