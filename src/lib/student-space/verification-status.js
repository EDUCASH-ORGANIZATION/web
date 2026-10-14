// @ds-screen RD-STUDENT-01
// Statut de vérification d'un étudiant, vu de son espace. Pur.
// Aucun délai d'examen n'est annoncé (consigne CLAUDE.md).
import { todayInBenin } from "../vitrine/dates.js"
import { studentVerifyHref } from "../app/student-routes.js"

/** Nombre de jours avant l'échéance du badge à partir duquel il « expire bientôt ». */
export const EXPIRING_DAYS = 30

const DAY_MS = 86_400_000

/**
 * @typedef {"not_submitted" | "pending" | "verified" | "expiring" | "expired" | "rejected"} VerificationKey
 * @typedef {{ key: VerificationKey, label: string, canApply: boolean, daysLeft: number | null, action: { label: string, href: string } | null }} VerificationView
 */

const SEND_CARD = { label: "Envoyer ma carte", href: studentVerifyHref() }
const RESEND_CARD = { label: "Renvoyer ma carte", href: studentVerifyHref() }
const RENEW_BADGE = { label: "Renouveler mon badge", href: studentVerifyHref() }

/** Date civile "AAAA-MM-JJ" au Bénin : un horodatage complet est converti, une date seule est gardée. */
function beninDate(value) {
  if (!value) return null
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : todayInBenin(parsed)
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/**
 * Candidature (`canApply`) : permise si vérifié (badge non expiré) ou carte en cours d'examen ;
 * refusée si la carte n'a jamais été envoyée, a été refusée, ou si le badge a expiré (décision D2).
 * @param {{ isVerified?: boolean, verifiedUntil?: string|null, hasCard?: boolean, rejectionReason?: string|null, submittedAt?: string|null }} state
 * @param {string} [today] Date du jour au Bénin "AAAA-MM-JJ"
 * @returns {VerificationView}
 */
export function verificationView(
  { isVerified = false, verifiedUntil = null, hasCard = false, rejectionReason = null } = {},
  today = todayInBenin(),
) {
  if (isVerified) {
    const until = beninDate(verifiedUntil)
    // Une date de fin présente mais illisible ne vaut pas « vérifié sans fin » : le badge est traité comme expiré.
    if (!until && verifiedUntil !== null && verifiedUntil !== undefined && verifiedUntil !== "") {
      return { key: "expired", label: "Badge expiré", canApply: false, daysLeft: null, action: { ...RENEW_BADGE } }
    }
    if (!until) {
      return { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: null, action: null }
    }
    const daysLeft = daysBetween(today, until)
    if (daysLeft < 0) {
      return { key: "expired", label: "Badge expiré", canApply: false, daysLeft, action: { ...RENEW_BADGE } }
    }
    if (daysLeft <= EXPIRING_DAYS) {
      return { key: "expiring", label: "Badge à renouveler", canApply: true, daysLeft, action: { ...RENEW_BADGE } }
    }
    return { key: "verified", label: "Compte vérifié", canApply: true, daysLeft, action: null }
  }
  if (rejectionReason) {
    return { key: "rejected", label: "Carte refusée", canApply: false, daysLeft: null, action: { ...RESEND_CARD } }
  }
  if (hasCard) {
    return { key: "pending", label: "Carte en cours d'examen", canApply: true, daysLeft: null, action: null }
  }
  return { key: "not_submitted", label: "Carte à envoyer", canApply: false, daysLeft: null, action: { ...SEND_CARD } }
}

/**
 * Statut de vérification à partir des lignes lues côté serveur (`getMyProfile`, `getMyStudentProfile`).
 * Seul le statut calculé doit sortir du serveur, jamais les colonnes brutes.
 * @param {{ is_verified?: boolean, verified_until?: string|null, rejection_reason?: string|null } | null | undefined} profile
 * @param {{ card_url?: string|null } | null | undefined} studentProfile
 * @returns {VerificationView}
 */
export function verificationFromRows(profile, studentProfile) {
  return verificationView({
    isVerified: profile?.is_verified === true,
    verifiedUntil: profile?.verified_until ?? null,
    hasCard: Boolean(studentProfile?.card_url),
    rejectionReason: profile?.rejection_reason ?? null,
  })
}
