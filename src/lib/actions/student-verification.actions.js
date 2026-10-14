"use server"

// Lecture de la page Vérification de la carte (E12). `requireRole(["student"])` d'abord : `getMyProfile` et
// `getMyStudentProfile` n'ont que `requireUser`. Les colonnes privées (`rejection_reason`,
// `verification_submitted_at`, `card_url`) sont lues en service role APRÈS ce contrôle, par ces deux lectures
// serveur (colonnes explicites, filtre sur l'identifiant de la session) : le garde-fou des colonnes privées
// n'autorise leur lecture que dans profile.actions. Vers le navigateur : le statut calculé, des dates civiles ou déjà formatées, le
// motif de refus (rédigé par l'administration pour CET étudiant, seulement quand la carte est refusée) ;
// jamais l'URL ou le chemin de la carte (un booléen sert au calcul), jamais l'horodatage brut du dépôt.

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getMyProfile, getMyStudentProfile } from "@/lib/actions/profile.actions"
import { verificationView } from "@/lib/student-space/verification-status"
import { formatShortDate, todayInBenin } from "@/lib/app/format"

const ERR_LOAD = "Impossible de charger votre vérification."
const REASON_MAX = 300

/** Date civile "AAAA-MM-JJ" au Bénin : un horodatage est converti, une date seule est gardée, le reste donne null. */
function civilDate(value) {
  if (!value) return null
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : todayInBenin(parsed)
}

/**
 * @typedef {import("@/lib/student-space/verification-status").VerificationView & {
 *   until: string | null,
 *   submittedLabel: string | null,
 *   rejectionReason: string | null,
 * }} StudentVerification
 * `until` : date de fin du badge ("AAAA-MM-JJ"). `submittedLabel` : date de dépôt déjà formatée, seulement quand la
 * carte est en cours d'examen. `rejectionReason` : motif de refus, seulement quand la carte est refusée.
 */

/**
 * Statut de vérification de l'étudiant connecté.
 * @returns {Promise<{ verification: StudentVerification } | { error: string }>}
 */
export async function getStudentVerification() {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: auth.error }

    const [{ profile, error: profileError }, { studentProfile, error: studentError }] = await Promise.all([
      getMyProfile(),
      getMyStudentProfile(),
    ])
    if (profileError || studentError || !profile) return { error: ERR_LOAD }

    const view = verificationView({
      isVerified: profile.is_verified === true,
      verifiedUntil: profile.verified_until ?? null,
      hasCard: Boolean(studentProfile?.card_url),
      rejectionReason: profile.rejection_reason ?? null,
    })

    const reason = typeof profile.rejection_reason === "string" ? profile.rejection_reason.trim() : ""
    return {
      verification: {
        ...view,
        until: civilDate(profile.verified_until),
        submittedLabel: view.key === "pending" ? formatShortDate(profile.verification_submitted_at) || null : null,
        rejectionReason: view.key === "rejected" && reason ? reason.slice(0, REASON_MAX) : null,
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentVerification]", err)
    return { error: ERR_LOAD }
  }
}
