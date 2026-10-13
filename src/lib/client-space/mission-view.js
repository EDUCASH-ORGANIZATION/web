// Logique pure du détail de mission client (C04 à C11) : aucune donnée, aucun import serveur.
// Entrée : `detail` de getClientMissionDetail (voir son JSDoc).
import { missionStatusView } from "../app/mission-status.js"
import { escrowSplit } from "../app/money.js"
import { todayInBenin, isPastDeadline } from "../vitrine/dates.js"

/**
 * @param {Array<{ status: string }>} applications
 * @returns {{ total: number, pending: number, accepted: number, rejected: number }}
 */
export function applicationCounts(applications) {
  const list = Array.isArray(applications) ? applications : []
  const count = (status) => list.filter((a) => a?.status === status).length
  return { total: list.length, pending: count("pending"), accepted: count("accepted"), rejected: count("rejected") }
}

/**
 * Actions proposées au client selon le statut. Un client n'annule qu'une mission ouverte (RD-SEC-01) :
 * en cours, l'annulation relève de la médiation (aucune action client).
 * @param {string} status
 * @param {{ hasReview?: boolean }} [options]
 */
export function missionActions(status, { hasReview = false } = {}) {
  return {
    cancel: status === "open",
    reviewApplications: status === "open",
    confirmEnd: status === "in_progress",
    reportProblem: status === "in_progress",
    mediationNotice: status === "in_progress",
    rate: status === "done" && !hasReview,
    republish: status === "done",
    duplicate: status === "cancelled",
  }
}

const sumOf = (ledger, type) =>
  (Array.isArray(ledger) ? ledger : [])
    .filter((m) => m?.type === type)
    .reduce((acc, m) => acc + Math.abs(Number(m.amount) || 0), 0)

/**
 * Reçu d'une mission terminée, lu au grand livre visible du client (RLS : ses propres lignes seulement).
 * `wallet_release` écrit pour le client une ligne `release` au montant BRUT (commission incluse) et une
 * ligne `commission` distincte ; la ligne nette de l'étudiant est sous son user_id, donc invisible ici.
 * - `reserved` : somme des `reserve` ; `commission` : somme des `commission` ;
 * - `releasedGross` : somme des `release` du client (brut, commission incluse) ;
 * - `student` : versé à l'étudiant = `releasedGross - commission`, ou null si le grand livre est
 *   incomplet (aucune ligne `release` ou `commission`) : aucun montant n'est inventé.
 * `hasLedger` est faux si aucun mouvement n'existe (mission héritée).
 * @param {Array<{ type: string, amount: number|string }>} ledger
 * @returns {{ hasLedger: boolean, reserved: number, commission: number, releasedGross: number, student: number|null }}
 */
export function receiptFromLedger(ledger) {
  const list = Array.isArray(ledger) ? ledger : []
  const has = (type) => list.some((m) => m?.type === type)
  const commission = sumOf(list, "commission")
  const releasedGross = sumOf(list, "release")
  return {
    hasLedger: list.length > 0,
    reserved: sumOf(list, "reserve"),
    commission,
    releasedGross,
    student: has("release") && has("commission") ? Math.max(0, releasedGross - commission) : null,
  }
}

/**
 * Remboursement d'une mission annulée : montant total remboursé et date du dernier mouvement `refund`.
 * @param {Array<{ type: string, amount: number, createdAt: string }>} ledger
 * @returns {{ amount: number, date: string } | null} null si aucun remboursement n'est enregistré
 */
export function refundFromLedger(ledger) {
  const refunds = (Array.isArray(ledger) ? ledger : []).filter((m) => m?.type === "refund")
  if (refunds.length === 0) return null
  const last = refunds.reduce((a, b) => (String(b.createdAt) > String(a.createdAt) ? b : a))
  return { amount: sumOf(refunds, "refund"), date: last.createdAt }
}

/** Date de la réservation des fonds (première), pour la chronologie ; null si inconnue. */
export function reservedAt(ledger) {
  const dates = (Array.isArray(ledger) ? ledger : []).filter((m) => m?.type === "reserve").map((m) => m.createdAt)
  return dates.length ? dates.reduce((a, b) => (String(b) < String(a) ? b : a)) : null
}

/**
 * Tri des candidatures : "recent" (défaut, plus récentes d'abord) ou "rated" (mieux notées d'abord,
 * à note égale les plus récentes). Ne modifie pas la liste d'origine.
 * @param {Array<{ createdAt: string, student?: { rating?: number } }>} applications
 * @param {"recent"|"rated"} [order]
 */
export function sortApplications(applications, order = "recent") {
  const byRecent = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt))
  const list = [...(applications ?? [])]
  if (order === "rated") {
    return list.sort((a, b) => (Number(b.student?.rating) || 0) - (Number(a.student?.rating) || 0) || byRecent(a, b))
  }
  return list.sort(byRecent)
}

/**
 * Tout ce que les vues dérivent de `detail`, calculé une fois.
 * @param {import("@/lib/actions/client-mission-detail.actions").ClientMissionDetail} detail
 * @param {string} [today] "AAAA-MM-JJ" (défaut : date du jour au Bénin)
 */
export function missionView(detail, today = todayInBenin()) {
  const { mission, applications, ledger, review } = detail
  const status = missionStatusView(mission, today)
  return {
    status,
    overdue: status.key === "overdue",
    deadlinePassed: isPastDeadline(mission.deadline, today),
    counts: applicationCounts(applications),
    split: escrowSplit(mission.budget),
    actions: missionActions(mission.status, { hasReview: Boolean(review) }),
    receipt: receiptFromLedger(ledger),
    refund: refundFromLedger(ledger),
    reservedAt: reservedAt(ledger),
  }
}

/**
 * Props de l'ancien composant MissionDetailTabs (forme `applications` d'avant la refonte), pour les
 * bouchons de ST-09. À retirer avec eux quand ST-10 et ST-11 ont remplacé les vues.
 * @param {import("@/lib/actions/client-mission-detail.actions").ClientMissionDetail} detail
 */
export function toLegacyTabsProps(detail) {
  const { mission, applications } = detail
  return {
    mission: { id: mission.id, title: mission.title, budget: mission.budget, status: mission.status },
    applications: applications.map((a) => ({
      id: a.id,
      mission_id: mission.id,
      student_id: a.studentId,
      message: a.message,
      status: a.status,
      created_at: a.createdAt,
      profiles: {
        full_name: a.student.fullName,
        avatar_url: a.student.avatarUrl,
        city: a.student.city,
        rating: a.student.rating,
        missions_done: a.student.missionsDone,
        is_verified: a.student.isVerified,
        verified_until: a.student.verifiedUntil,
      },
      student_profiles: { school: a.student.school, level: a.student.level, skills: a.student.skills },
    })),
  }
}
