// @ds-screen RD-STUDENT-01
// Logique pure du détail de mission étudiant (E03, E05) : aiguillage, gain, actions, chronologie, reçu.
// Aucune donnée, aucun import serveur. Entrée : `detail` de getStudentMissionDetail (voir son JSDoc).
import { missionStatusView } from "../app/mission-status.js"
import { escrowSplit } from "../app/money.js"
import { todayInBenin, isPastDeadline } from "../vitrine/dates.js"

/**
 * Aiguillage de la page : "followup" (E05) pour l'étudiant retenu d'une mission qui n'est plus ouverte ;
 * "apply" (E03) sinon (mission ouverte, étudiant non retenu, mission plus ouverte).
 * @param {{ state?: string, isSelected?: boolean, mission?: { status?: string } } | null | undefined} detail
 * @returns {"apply" | "followup"}
 */
export function pickMissionView(detail) {
  if (detail?.state === "selected" && detail.isSelected === true && detail.mission?.status !== "open") {
    return "followup"
  }
  return "apply"
}

/**
 * Actions proposées à l'étudiant. Aucun bouton « J'ai terminé » ni retrait de candidature (aucun support en base).
 * - `canApply` : mission ouverte, pas encore de candidature, vérification qui le permet (décision D2) ;
 * - `needsVerification` : la vérification bloque la candidature (carte à envoyer, refusée ou badge expiré) ;
 * - `alreadyApplied` : une candidature existe déjà ;
 * - `writeToClient`, `reportProblem`, `rate`, `viewReview` : suivi de la mission retenue.
 * @param {import("@/lib/actions/student-mission-detail.actions").StudentMissionDetail} detail
 */
export function missionActions(detail) {
  if (!detail || detail.state === "closed") {
    return {
      canApply: false,
      needsVerification: false,
      alreadyApplied: false,
      writeToClient: false,
      reportProblem: false,
      rate: false,
      viewReview: false,
    }
  }
  const { mission, application, verification, isSelected, review } = detail
  const open = mission.status === "open"
  const followed = isSelected === true && !open
  const verificationOk = verification ? verification.canApply : false
  return {
    canApply: open && !application && verificationOk,
    needsVerification: open && !application && Boolean(verification) && !verification.canApply,
    alreadyApplied: Boolean(application),
    writeToClient: followed && (mission.status === "in_progress" || mission.status === "done"),
    reportProblem: followed && mission.status === "in_progress",
    rate: followed && mission.status === "done" && !review,
    viewReview: followed && mission.status === "done" && Boolean(review),
  }
}

/**
 * Reçu d'une mission terminée, lu au grand livre de l'étudiant : la ligne `release` sous son user_id porte son NET.
 * `net` est null si aucune ligne n'existe : aucun montant n'est inventé (« Paiement en cours de traitement »).
 * @param {Array<{ type: string, amount: number, createdAt: string }>} ledger
 * @returns {{ hasLedger: boolean, net: number|null, date: string|null }}
 */
export function receiptFromLedger(ledger) {
  const releases = (Array.isArray(ledger) ? ledger : []).filter((m) => m?.type === "release")
  if (releases.length === 0) return { hasLedger: false, net: null, date: null }
  const net = releases.reduce((acc, m) => acc + Math.abs(Number(m.amount) || 0), 0)
  const date = releases.reduce((a, b) => (String(b.createdAt) > String(a) ? b.createdAt : a), releases[0].createdAt)
  return { hasLedger: true, net, date }
}

/**
 * Chronologie fondée sur les seules dates connues : candidature, acceptation (mise à jour de la candidature
 * acceptée), paiement (grand livre), avis. Une étape sans date connue garde `date: null`.
 * `state` : "done" | "now" | "todo". Mission annulée : seules la candidature et la sélection sont listées.
 * @param {import("@/lib/actions/student-mission-detail.actions").StudentMissionDetailOpen} detail
 * @returns {Array<{ key: "applied" | "selected" | "paid" | "reviewed", state: "done" | "now" | "todo", date: string|null }>}
 */
export function buildTimeline(detail) {
  const { mission, application, ledger, review } = detail
  const receipt = receiptFromLedger(ledger)
  const applied = { key: "applied", state: "done", date: application?.createdAt ?? null }
  const selected = { key: "selected", state: "done", date: application?.updatedAt ?? null }
  if (mission.status === "cancelled") return [applied, selected]
  if (mission.status === "in_progress") {
    return [
      applied,
      selected,
      { key: "paid", state: "now", date: null },
      { key: "reviewed", state: "todo", date: null },
    ]
  }
  // done
  return [
    applied,
    selected,
    { key: "paid", state: "done", date: receipt.date },
    { key: "reviewed", state: review ? "done" : "now", date: review?.createdAt ?? null },
  ]
}

/**
 * Tout ce que les vues dérivent de `detail`, calculé une fois. Pour une mission « plus ouverte » : `{ closed: true }`.
 * @param {import("@/lib/actions/student-mission-detail.actions").StudentMissionDetail} detail
 * @param {string} [today] "AAAA-MM-JJ" (défaut : date du jour au Bénin)
 */
export function missionDetailView(detail, today = todayInBenin()) {
  if (!detail || detail.state === "closed") return { closed: true }
  const { mission } = detail
  return {
    closed: false,
    status: missionStatusView(mission, today),
    deadlinePassed: isPastDeadline(mission.deadline, today),
    split: escrowSplit(mission.budget),
    actions: missionActions(detail),
    timeline: detail.state === "selected" ? buildTimeline(detail) : [],
    receipt: receiptFromLedger(detail.ledger),
  }
}
