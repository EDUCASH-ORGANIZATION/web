"use server"

import { todayInBenin } from "@/lib/vitrine/dates"
import { classifyDossier, sortQueue } from "@/lib/admin-space/verification-queue"
import { WITHDRAWAL_STUCK_HOURS, moneyAlertsFromWallets } from "@/lib/admin-space/dashboard-queue"
import {
  inChunks,
  readAllRows,
  requireAdminService,
  sumColumnPaged,
} from "./admin-context"

const DOSSIER_LIMIT = 10
const ALERT_LIMIT = 50
const WITHDRAWAL_LIMIT = 50
const RECENT_LIMIT = 5
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

/** Noms publics (`profiles.full_name` seulement) d'une liste d'identifiants. */
async function readNames(service, ids) {
  const names = new Map()
  for (const chunk of inChunks([...new Set(ids.filter(Boolean))])) {
    const { data, error } = await service.from("profiles").select("user_id, full_name").in("user_id", chunk)
    if (error) throw new Error("Lecture impossible.")
    for (const row of data ?? []) names.set(row.user_id, row.full_name ?? "")
  }
  return names
}

/** Exécute un bloc : en cas d'erreur, `{ ok: false }` sans casser les autres blocs (aucun détail technique renvoyé). */
async function block(tag, run) {
  try {
    return { ok: true, ...(await run()) }
  } catch (err) {
    console.error(`[admin-dashboard] ${tag}:`, err?.message)
    return { ok: false }
  }
}

// Alertes d'argent : solde négatif ou argent réservé supérieur au solde, sur tous les portefeuilles (pagination).
async function walletAlerts(service) {
  const wallets = await readAllRows(
    () => service.from("wallets").select("user_id, balance, reserved").order("user_id", { ascending: true }),
    "portefeuilles",
  )
  const all = moneyAlertsFromWallets(wallets.map((w) => ({ userId: w.user_id, balance: w.balance, reserved: w.reserved })))
  const shown = all.slice(0, ALERT_LIMIT)
  const names = await readNames(service, shown.map((a) => a.userId))
  return {
    total: all.length,
    items: shown.map((alert) => ({ ...alert, name: names.get(alert.userId) ?? "" })),
  }
}

// Retrait débité sans virement créé : `fedapay_id` est écrit par `process-withdrawal` après la création du virement ;
// absent depuis plus de 24 h, le portefeuille a été débité sans que le virement parte.
async function stuckWithdrawals(service, now) {
  const cutoff = new Date(now.getTime() - WITHDRAWAL_STUCK_HOURS * HOUR_MS).toISOString()
  const { data, error } = await service
    .from("wallet_transactions")
    .select("id, user_id, amount, created_at")
    .eq("type", "withdrawal")
    .is("fedapay_id", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(WITHDRAWAL_LIMIT)
  if (error) throw new Error("Lecture impossible.")
  const rows = data ?? []
  const names = await readNames(service, rows.map((r) => r.user_id))
  return {
    items: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: names.get(r.user_id) ?? "",
      amount: Math.abs(Number(r.amount) || 0),
      createdAt: r.created_at,
    })),
  }
}

// Dossiers « À examiner » : même règle que `classifyDossier` et que le compteur de la coquille. Total exact, les
// DOSSIER_LIMIT plus anciens renvoyés (nom et dates seulement : ni e-mail, ni téléphone, ni carte).
async function pendingDossiers(service, now) {
  const today = todayInBenin(now)
  const cards = await readAllRows(
    () => service.from("student_profiles").select("user_id").not("card_url", "is", null).order("user_id", { ascending: true }),
    "cartes de l'accueil",
  )
  const pending = []
  for (const chunk of inChunks(cards.map((c) => c.user_id))) {
    const { data, error } = await service
      .from("profiles")
      .select("user_id, full_name, verified_until, verification_submitted_at, created_at")
      .in("user_id", chunk)
      .eq("role", "student")
      .eq("is_verified", false)
      .is("rejection_reason", null)
    if (error) throw new Error("Lecture impossible.")
    for (const p of data ?? []) {
      const tab = classifyDossier(
        { isVerified: false, verifiedUntil: p.verified_until, hasCard: true, submittedAt: p.verification_submitted_at },
        today,
      )
      if (tab === "a-examiner") {
        pending.push({
          userId: p.user_id,
          name: p.full_name ?? "",
          submittedAt: p.verification_submitted_at ?? null,
          createdAt: p.created_at ?? null,
        })
      }
    }
  }
  return { total: pending.length, dossiers: sortQueue(pending).slice(0, DOSSIER_LIMIT) }
}

// Séquestre total : somme de `wallets.reserved` sur tous les portefeuilles ; missions financées : missions ouvertes
// ou en cours (la publication réserve le budget).
async function escrow(service) {
  const total = await sumColumnPaged(service, "wallets", "reserved", [])
  const { count, error } = await service
    .from("missions")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"])
  return { total, fundedMissions: error ? null : (count ?? 0) }
}

// Commissions du mois (jour du Bénin) : mouvements `commission` du grand livre, jamais la table héritée `transactions`.
async function monthCommissions(service, today) {
  const month = today.slice(0, 7)
  const total = await sumColumnPaged(service, "wallet_transactions", "amount", [
    ["eq", "type", "commission"],
    ["gte", "created_at", `${month}-01T00:00:00+01:00`],
  ])
  return { month, total }
}

// Missions publiées sur 7 jours glissants et part déjà pourvue (étudiant retenu).
async function weekMissions(service, now) {
  const since = new Date(now.getTime() - WEEK_MS).toISOString()
  const [published, filled] = await Promise.all([
    service.from("missions").select("id", { count: "exact", head: true }).gte("created_at", since),
    service.from("missions").select("id", { count: "exact", head: true }).gte("created_at", since).not("selected_student_id", "is", null),
  ])
  if (published.error || filled.error) throw new Error("Lecture impossible.")
  return { published: published.count ?? 0, filled: filled.count ?? 0 }
}

// Derniers inscrits (étudiants et clients), lus seulement quand la file est vide.
async function latestSignups(service) {
  const { data, error } = await service
    .from("profiles")
    .select("user_id, full_name, role, created_at")
    .in("role", ["student", "client"])
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT)
  if (error) throw new Error("Lecture impossible.")
  return {
    users: (data ?? []).map((u) => ({ userId: u.user_id, name: u.full_name ?? "", role: u.role, createdAt: u.created_at })),
  }
}

/**
 * Données du tableau de bord admin. Chaque bloc est indépendant : un bloc en erreur vaut `{ ok: false }` et
 * n'empêche pas les autres. Aucune donnée privée (ni téléphone, ni e-mail, ni carte). Les éléments de la file
 * (alertes, retraits, dossiers) se combinent avec `buildQueue` côté vue, `dossiers.total` donnant le total exact.
 * @returns {Promise<{ error: string } | {
 *   now: string, today: string,
 *   alerts: { ok: boolean, total?: number, items?: object[] },
 *   withdrawals: { ok: boolean, items?: object[] },
 *   dossiers: { ok: boolean, total?: number, dossiers?: object[] },
 *   escrow: { ok: boolean, total?: number, fundedMissions?: number | null },
 *   commissions: { ok: boolean, month?: string, total?: number },
 *   missions: { ok: boolean, published?: number, filled?: number },
 *   recent: { ok: boolean, users?: object[] } | null,
 * }>}
 */
export async function getAdminDashboard() {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  const now = new Date()
  const today = todayInBenin(now)
  const [alerts, withdrawals, dossiers, escrowBlock, commissions, missions] = await Promise.all([
    block("alertes", () => walletAlerts(service)),
    block("retraits", () => stuckWithdrawals(service, now)),
    block("dossiers", () => pendingDossiers(service, now)),
    block("séquestre", () => escrow(service)),
    block("commissions", () => monthCommissions(service, today)),
    block("missions", () => weekMissions(service, now)),
  ])

  const queueEmpty =
    alerts.ok && alerts.total === 0 && withdrawals.ok && withdrawals.items.length === 0 && dossiers.ok && dossiers.total === 0
  const recent = queueEmpty ? await block("inscrits", () => latestSignups(service)) : null

  return {
    now: now.toISOString(),
    today,
    alerts,
    withdrawals,
    dossiers,
    escrow: escrowBlock,
    commissions,
    missions,
    recent,
  }
}
