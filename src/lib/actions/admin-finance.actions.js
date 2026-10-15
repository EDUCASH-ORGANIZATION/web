"use server"

import { moneyAlertsFromWallets } from "@/lib/admin-space/dashboard-queue"
import {
  FINANCE_PAGE_SIZE,
  clampPage,
  operatorFromNote,
  parseTransactionParams,
  parseWalletParams,
  parseWithdrawalParams,
  periodStart,
  splitPage,
  walletAnomaly,
  walletAvailable,
  withdrawalStatus,
} from "@/lib/admin-space/finance"
import { escapeLike } from "@/lib/student-space/explore-query"
import { inChunks, readAllRows, requireAdminService, sumColumnPaged } from "./admin-context"

// Écrans finances de l'espace admin (RD-ADMIN-01) : AD11 transactions, AD12 portefeuilles, AD13 retraits.
// Lecture seule : aucune écriture, aucun mouvement d'argent. Lectures via le client service role, après le contrôle
// admin. Seul le nom public (`profiles.full_name`) est lu ; ni téléphone, ni e-mail, ni note brute n'est renvoyé.

const ANOMALY_LIMIT = 5
const ERR_TRANSACTIONS = "Les mouvements n'ont pas pu être chargés. Réessayez dans un instant."
const ERR_WALLETS = "Les portefeuilles n'ont pas pu être chargés. Réessayez dans un instant."
const ERR_WITHDRAWALS = "Les retraits n'ont pas pu être chargés. Réessayez dans un instant."

const TRANSACTION_COLUMNS = "id, user_id, type, amount, balance_after, mission_id, note, fedapay_id, reverses_id, created_at"

/** Noms publics d'une liste d'identifiants (paquets de 100). */
async function readNames(service, ids) {
  const names = new Map()
  for (const chunk of inChunks([...new Set(ids.filter(Boolean))])) {
    const { data, error } = await service.from("profiles").select("user_id, full_name").in("user_id", chunk)
    if (error) throw new Error("Lecture impossible.")
    for (const row of data ?? []) names.set(row.user_id, row.full_name ?? "")
  }
  return names
}

/** Exécute un bloc d'indicateurs : en erreur, `{ ok: false }` sans casser les autres blocs. */
async function block(tag, run) {
  try {
    return { ok: true, ...(await run()) }
  } catch (err) {
    console.error(`[admin-finance] ${tag}:`, err?.message)
    return { ok: false }
  }
}

async function countRows(query) {
  const { count, error } = await query
  if (error) throw new Error("Lecture impossible.")
  return count ?? 0
}

/** Application des filtres de la liste des mouvements (type, période, référence de paiement). */
function transactionFilters(query, { type, referenceOnly }, start) {
  let q = query.gte("created_at", start)
  if (type) q = q.eq("type", type)
  if (referenceOnly) q = q.eq("fedapay_id", referenceOnly)
  return q
}

/**
 * Journal des mouvements du portefeuille (AD11). Filtres en listes fermées, recherche par référence de paiement
 * (égalité exacte), trois indicateurs calculés sur TOUTES les lignes de la période (pagination des sommes).
 * @param {{ type?: string, periode?: string, q?: string, page?: number|string }} [params]
 */
export async function listAdminTransactions(params = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  const parsed = parseTransactionParams(params)
  const now = new Date()
  const start = periodStart(parsed.periode, now)
  const period = [["gte", "created_at", start]]
  const searching = parsed.q !== ""

  const [deposits, commissions, released] = await Promise.all([
    block("recharges", async () => ({
      total: await sumColumnPaged(service, "wallet_transactions", "amount", [["eq", "type", "deposit"], ...period]),
      count: await countRows(
        service.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("type", "deposit").gte("created_at", start),
      ),
    })),
    block("commissions", async () => ({
      total: await sumColumnPaged(service, "wallet_transactions", "amount", [["eq", "type", "commission"], ...period]),
    })),
    block("versements", async () => ({
      total: await sumColumnPaged(service, "wallet_transactions", "amount", [["eq", "type", "release"], ...period]),
    })),
  ])

  const filters = { type: parsed.type, referenceOnly: searching ? parsed.q : "" }
  let rows = []
  let total = 0
  let page = 1
  try {
    // Une saisie qui n'a pas la forme d'une référence ne peut correspondre à rien : aucune requête, aucune erreur.
    if (parsed.referenceOk) {
      total = await countRows(
        transactionFilters(service.from("wallet_transactions").select("id", { count: "exact", head: true }), filters, start),
      )
      page = clampPage(parsed.page, total)
      if (total > 0) {
        const from = (page - 1) * FINANCE_PAGE_SIZE
        const { data, error } = await transactionFilters(service.from("wallet_transactions").select(TRANSACTION_COLUMNS), filters, start)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + FINANCE_PAGE_SIZE - 1)
        if (error) throw new Error("Lecture impossible.")
        const names = await readNames(service, (data ?? []).map((r) => r.user_id))
        rows = (data ?? []).map((r) => ({
          id: r.id,
          userId: r.user_id ?? null,
          name: names.get(r.user_id) ?? "",
          type: r.type,
          amount: Math.abs(Number(r.amount) || 0),
          balanceAfter: r.balance_after === null || r.balance_after === undefined ? null : Number(r.balance_after),
          missionId: r.mission_id ?? null,
          reference: r.fedapay_id ?? null,
          isReversal: Boolean(r.reverses_id),
          operator: r.type === "withdrawal" ? operatorFromNote(r.note) : null,
          createdAt: r.created_at,
        }))
      }
    }
  } catch (err) {
    console.error("[admin-finance] mouvements:", err?.message)
    return { error: ERR_TRANSACTIONS }
  }

  return {
    now: now.toISOString(),
    type: parsed.type,
    periode: parsed.periode,
    q: parsed.q,
    page,
    pageSize: FINANCE_PAGE_SIZE,
    total,
    rows,
    stats: { deposits, commissions, released },
  }
}

/**
 * Retraits (AD13), lecture seule. En tête : les retraits débités sans référence de paiement (plus anciens d'abord),
 * puis les retraits déjà recrédités, puis ceux dont le virement est créé (plus récents d'abord).
 * @param {{ page?: number|string }} [params]
 */
export async function listAdminWithdrawals(params = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  const parsed = parseWithdrawalParams(params)
  const now = new Date()
  try {
    // Demandes de retrait (les lignes d'annulation, qui pointent vers une autre ligne, ne sont pas des demandes).
    const withoutReference = await readAllRows(
      () =>
        service
          .from("wallet_transactions")
          .select("id, user_id, amount, note, created_at")
          .eq("type", "withdrawal")
          .is("fedapay_id", null)
          .is("reverses_id", null)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      "retraits sans référence",
    )
    const reversedIds = new Set()
    for (const chunk of inChunks(withoutReference.map((r) => r.id))) {
      const { data, error } = await service.from("wallet_transactions").select("reverses_id").in("reverses_id", chunk)
      if (error) throw new Error("Lecture impossible.")
      for (const row of data ?? []) reversedIds.add(row.reverses_id)
    }
    const open = withoutReference.filter((r) => !reversedIds.has(r.id))
    const reversed = withoutReference.filter((r) => reversedIds.has(r.id)).reverse()
    const head = [...open, ...reversed]

    const created = await countRows(
      service
        .from("wallet_transactions")
        .select("id", { count: "exact", head: true })
        .eq("type", "withdrawal")
        .not("fedapay_id", "is", null)
        .is("reverses_id", null),
    )
    const total = head.length + created
    const page = clampPage(parsed.page, total)
    const window = splitPage(page, head.length)

    const pageRows = head.slice(window.head[0], window.head[1]).map((r) => ({ ...r, reference: null, reversed: reversedIds.has(r.id) }))
    if (window.tail) {
      const { data, error } = await service
        .from("wallet_transactions")
        .select("id, user_id, amount, note, fedapay_id, created_at")
        .eq("type", "withdrawal")
        .not("fedapay_id", "is", null)
        .is("reverses_id", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(window.tail[0], window.tail[1] - 1)
      if (error) throw new Error("Lecture impossible.")
      for (const r of data ?? []) pageRows.push({ ...r, reference: r.fedapay_id, reversed: false })
    }

    const names = await readNames(service, pageRows.map((r) => r.user_id))
    const rows = pageRows.map((r) => ({
      id: r.id,
      userId: r.user_id ?? null,
      name: names.get(r.user_id) ?? "",
      amount: Math.abs(Number(r.amount) || 0),
      operator: operatorFromNote(r.note),
      reference: r.reference,
      createdAt: r.created_at,
      status: withdrawalStatus({ reference: r.reference, reversed: r.reversed, createdAt: r.created_at }, now),
    }))

    const stuck = open.filter((r) => withdrawalStatus({ createdAt: r.created_at }, now) === "stuck")
    return {
      now: now.toISOString(),
      page,
      pageSize: FINANCE_PAGE_SIZE,
      total,
      rows,
      stats: {
        undebitedTransfer: {
          open: open.length,
          stuck: stuck.length,
          amount: stuck.reduce((sum, r) => sum + Math.abs(Number(r.amount) || 0), 0),
          oldestAt: stuck[0]?.created_at ?? null,
        },
        reversed: reversed.length,
        created,
      },
    }
  } catch (err) {
    console.error("[admin-finance] retraits:", err?.message)
    return { error: ERR_WITHDRAWALS }
  }
}

function profileOf(row) {
  const p = Array.isArray(row?.profiles) ? row.profiles[0] : row?.profiles
  return p && typeof p === "object" ? p : {}
}

/**
 * Portefeuilles (AD12) : totaux (en circulation, séquestre, disponible) sur TOUS les portefeuilles par pagination,
 * heure du calcul, anomalies (solde négatif, réservé supérieur au solde) et liste paginée triée par solde,
 * recherche par nom.
 * @param {{ q?: string, page?: number|string }} [params]
 */
export async function getAdminWallets(params = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  const parsed = parseWalletParams(params)
  const now = new Date()

  const [totals, anomalies, walletCount] = await Promise.all([
    block("totaux", async () => {
      const balance = await sumColumnPaged(service, "wallets", "balance", [])
      const reserved = await sumColumnPaged(service, "wallets", "reserved", [])
      return { circulation: balance, reserved, available: walletAvailable(balance, reserved) }
    }),
    block("anomalies", async () => {
      const wallets = await readAllRows(
        () => service.from("wallets").select("user_id, balance, reserved").order("user_id", { ascending: true }),
        "portefeuilles",
      )
      const all = moneyAlertsFromWallets(wallets.map((w) => ({ userId: w.user_id, balance: w.balance, reserved: w.reserved })))
      const shown = all.slice(0, ANOMALY_LIMIT)
      const names = await readNames(service, shown.map((a) => a.userId))
      return { total: all.length, items: shown.map((a) => ({ ...a, name: names.get(a.userId) ?? "" })) }
    }),
    block("nombre", async () => ({
      count: await countRows(service.from("wallets").select("user_id", { count: "exact", head: true })),
    })),
  ])

  try {
    const searching = parsed.q !== ""
    const pattern = `%${escapeLike(parsed.q)}%`
    const embed = searching ? "profiles!inner(full_name, role)" : "profiles(full_name, role)"
    const filtered = (query) => (searching ? query.ilike("profiles.full_name", pattern) : query)

    const total = await countRows(filtered(service.from("wallets").select(`user_id, ${embed}`, { count: "exact", head: true })))
    const page = clampPage(parsed.page, total)
    const from = (page - 1) * FINANCE_PAGE_SIZE
    const { data, error } = await filtered(service.from("wallets").select(`user_id, balance, reserved, ${embed}`))
      .order("balance", { ascending: false })
      .order("user_id", { ascending: true })
      .range(from, from + FINANCE_PAGE_SIZE - 1)
    if (error) throw new Error("Lecture impossible.")

    const rows = (data ?? []).map((w) => {
      const profile = profileOf(w)
      return {
        userId: w.user_id,
        name: profile.full_name ?? "",
        role: profile.role ?? null,
        balance: Number(w.balance) || 0,
        reserved: Number(w.reserved) || 0,
        available: walletAvailable(w.balance, w.reserved),
        anomaly: walletAnomaly(w),
      }
    })

    return {
      now: now.toISOString(),
      q: parsed.q,
      page,
      pageSize: FINANCE_PAGE_SIZE,
      total,
      walletCount: walletCount.ok ? walletCount.count : null,
      totals,
      anomalies,
      rows,
    }
  } catch (err) {
    console.error("[admin-finance] portefeuilles:", err?.message)
    return { error: ERR_WALLETS }
  }
}
