// @ds-screen RD-ADMIN-01
// File de l'accueil admin (AD01). Ordre : alertes d'argent (portefeuilles, puis retraits débités sans virement
// créé depuis plus de 24 h), puis dossiers de vérification du plus ancien au plus récent. Pur.
import { sortQueue } from "./verification-queue"

export const WITHDRAWAL_STUCK_HOURS = 24
const HOUR_MS = 60 * 60 * 1000

function amount(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Alertes d'argent des portefeuilles : solde négatif, ou argent réservé supérieur au solde.
 * @param {Array<{ userId: string, name?: string|null, balance: number|string, reserved: number|string }>} wallets
 */
export function moneyAlertsFromWallets(wallets) {
  const alerts = []
  for (const wallet of wallets ?? []) {
    const balance = amount(wallet.balance)
    const reserved = amount(wallet.reserved)
    if (balance < 0) {
      alerts.push({ reason: "negative-balance", userId: wallet.userId, name: wallet.name ?? "", balance, reserved, gap: -balance })
    } else if (reserved > balance) {
      alerts.push({ reason: "reserved-over-balance", userId: wallet.userId, name: wallet.name ?? "", balance, reserved, gap: reserved - balance })
    }
  }
  const rank = (alert) => (alert.reason === "negative-balance" ? 0 : 1)
  return alerts.sort((a, b) => rank(a) - rank(b) || b.gap - a.gap)
}

/**
 * Éléments à traiter, dans l'ordre de priorité.
 * @param {{
 *   moneyAlerts?: ReturnType<typeof moneyAlertsFromWallets>,
 *   withdrawals?: Array<{ id: string, userId?: string, name?: string, amount?: number, createdAt: string }>,
 *   dossiers?: Array<{ userId: string, name?: string, submittedAt?: string|null, createdAt?: string|null }>,
 * }} input
 * @param {Date} now
 */
export function buildQueue({ moneyAlerts = [], withdrawals = [], dossiers = [] } = {}, now) {
  const stuck = sortQueue(
    withdrawals.filter((w) => {
      const t = new Date(w.createdAt).getTime()
      return !Number.isNaN(t) && now.getTime() - t > WITHDRAWAL_STUCK_HOURS * HOUR_MS
    }),
    (w) => w.createdAt,
  )
  return [
    ...moneyAlerts.map((alert) => ({ key: `wallet:${alert.userId}`, kind: "money", ...alert })),
    ...stuck.map((w) => ({
      key: `withdrawal:${w.id}`,
      kind: "money",
      reason: "withdrawal-stuck",
      userId: w.userId ?? null,
      name: w.name ?? "",
      amount: amount(w.amount),
      since: w.createdAt,
    })),
    ...sortQueue(dossiers).map((d) => ({
      key: `dossier:${d.userId}`,
      kind: "dossier",
      userId: d.userId,
      name: d.name ?? "",
      since: d.submittedAt ?? d.createdAt ?? null,
    })),
  ]
}

/** Élément prioritaire (premier de la file) ou null. */
export function heroItem(queue) {
  return queue?.[0] ?? null
}

/** Éléments qui suivent l'élément prioritaire. */
export function nextItems(queue, limit = 6) {
  return (queue ?? []).slice(1, 1 + Math.max(0, limit))
}

/** Total à traiter et détail par nature. */
export function totalToHandle(queue) {
  const items = queue ?? []
  return {
    total: items.length,
    money: items.filter((i) => i.kind === "money").length,
    dossiers: items.filter((i) => i.kind === "dossier").length,
  }
}
