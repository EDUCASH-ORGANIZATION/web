// @ds-screen RD-ADMIN-01
// Logique pure du détail d'une mission admin (AD07) : argent, frise, libellés de candidature. Lecture seule.
import { escrowSplit } from "@/lib/app/money"
import { formatAmount } from "@/lib/app/format"

export const APPLICATION_STATUS_LABELS = {
  pending: "En attente",
  accepted: "Retenue",
  rejected: "Non retenue",
}

export function applicationStatusLabel(status) {
  return APPLICATION_STATUS_LABELS[status] ?? "Statut inconnu"
}

const abs = (value) => Math.abs(Number(value) || 0)

/**
 * Argent d'une mission, lu dans le grand livre : `reserve` et `release` du client (le séquestre), `commission`,
 * `release` de l'étudiant (la part nette), `refund`. Le prévu vient du budget par `escrowSplit` (jamais de taux en dur).
 * @param {{ budget: number, clientId: string, ledger: Array<{ type: string, amount: number, userId: string }> }} input
 */
export function moneySummary({ budget, clientId, ledger }) {
  const entries = Array.isArray(ledger) ? ledger : []
  const sum = (predicate) => entries.filter(predicate).reduce((total, m) => total + abs(m.amount), 0)
  const reserved = sum((m) => m.type === "reserve" && m.userId === clientId)
  const released = sum((m) => m.type === "release" && m.userId === clientId)
  const commission = sum((m) => m.type === "commission")
  const studentReceived = sum((m) => m.type === "release" && m.userId !== clientId)
  const refunded = sum((m) => m.type === "refund")
  return {
    planned: escrowSplit(budget),
    reserved,
    released,
    commission,
    studentReceived,
    refunded,
    inEscrow: Math.max(0, reserved - released - refunded),
    hasMovements: entries.length > 0,
  }
}

/**
 * Étapes de la frise, fondées sur les seules dates connues (`completion` = `{ declaredAt, finishedAt }`) : aucune date de sélection n'est stockée, l'étape
 * « Étudiant retenu » n'en porte donc pas. Les états sont `done`, `current` ou `todo`.
 * @returns {Array<{ state: "done"|"current"|"todo", icon: string, title: string, at: string|null }>}
 */
export function buildMissionTimeline({ mission, studentName, completion, ledger, clientId }) {
  const items = [{ state: "done", icon: "i-check", title: "Mission publiée", at: mission.createdAt }]
  const moves = [...(Array.isArray(ledger) ? ledger : [])].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  const first = (type, predicate = () => true) => moves.find((m) => m.type === type && predicate(m))

  if (mission.selectedStudentId) {
    items.push({ state: "done", icon: "i-user-check", title: `Étudiant retenu : ${studentName || "compte sans nom"}`, at: null })
  }
  const reserve = first("reserve", (m) => m.userId === clientId)
  if (reserve) {
    items.push({ state: "done", icon: "i-lock", title: `${formatAmount(abs(reserve.amount))} placés en séquestre`, at: reserve.createdAt })
  }

  if (mission.status === "cancelled") {
    items.push({ state: "done", icon: "i-x", title: "Mission annulée", at: mission.updatedAt ?? null })
    const refund = first("refund")
    if (refund) items.push({ state: "done", icon: "i-undo", title: `${formatAmount(abs(refund.amount))} remboursés au client`, at: refund.createdAt })
    return items
  }
  if (mission.status === "done") {
    if (completion?.declaredAt) {
      items.push({ state: "done", icon: "i-check", title: "Fin déclarée par l'étudiant", at: completion.declaredAt })
    }
    items.push({ state: "done", icon: "i-check-circle", title: "Mission terminée", at: completion?.finishedAt ?? mission.updatedAt ?? null })
    const release = first("release", (m) => m.userId === clientId)
    if (release) items.push({ state: "done", icon: "i-coins", title: `${formatAmount(abs(release.amount))} libérés du séquestre`, at: release.createdAt })
    return items
  }
  if (mission.status === "in_progress") {
    if (completion?.declaredAt) {
      items.push({ state: "current", icon: "i-clock", title: "Fin déclarée par l'étudiant, à confirmer par le client", at: completion.declaredAt })
    } else {
      items.push({ state: "current", icon: "i-clock", title: "Mission en cours", at: null })
    }
    items.push({ state: "todo", icon: "i-coins", title: "Libération du séquestre", at: null })
    return items
  }
  items.push({ state: "current", icon: "i-clock", title: "En attente d'un étudiant", at: null })
  return items
}
