"use server"

import { revalidatePath } from "next/cache"
import { todayInBenin } from "@/lib/vitrine/dates"
import { escapeLike } from "@/lib/student-space/explore-query"
import { classifyDossier } from "@/lib/admin-space/verification-queue"
import { reasonSchema, uuidSchema } from "@/lib/admin-space/decision-schemas"
import {
  USERS_PAGE_SIZE,
  detectSearch,
  emailMatches,
  lastPage,
  parseUserParams,
  parseUserTab,
  verificationLabel,
} from "@/lib/admin-space/users"
import { notify } from "@/lib/notifications/notify"
import { accountReactivated } from "@/lib/notifications/catalog"
import { inChunks, logAdminAction, requireAdminService } from "./admin-context"

const ERR_READ = "Les comptes n'ont pas pu être chargés. Réessayez dans un instant."
const ERR_INVALID = "Ce compte est introuvable."
const ERR_SELF = "Vous ne pouvez pas modifier le statut de votre propre compte."
const ERR_ADMIN = "Le statut d'un compte administrateur ne peut pas être modifié."
const ERR_ALREADY_SUSPENDED = "Ce compte est déjà suspendu. Rechargez la page."
const ERR_NOT_SUSPENDED = "Ce compte n'est pas suspendu. Rechargez la page."
const ERR_WRITE = "Le changement n'a pas pu être enregistré. Réessayez dans un instant."

// Recherche par e-mail : 20 pages de 1000 comptes au plus, 100 correspondances au plus.
const AUTH_PAGE_SIZE = 1000
const AUTH_MAX_PAGES = 20
const EMAIL_MATCH_LIMIT = 100
const EMAIL_PARALLEL = 10
const DETAIL_LIST_LIMIT = 20

const LIST_COLUMNS =
  "user_id, full_name, role, city, is_verified, verified_until, rejection_reason, verification_submitted_at, is_suspended, missions_done, created_at"
const DETAIL_COLUMNS =
  "user_id, full_name, role, city, phone, is_verified, verified_until, rejection_reason, verification_submitted_at, is_suspended, missions_done, rating, created_at"
const MISSION_COLUMNS = "id, title, type, status, budget, city, deadline, created_at"

/** Applique les filtres de la liste. Chaque valeur vient d'une liste fermée ou d'un paramètre déjà validé. */
function applyFilters(query, params, search, today, emailIds) {
  let q = query
  if (params.role) q = q.eq("role", params.role)
  if (params.statut) q = q.eq("is_suspended", params.statut === "suspendu")
  if (params.verif === "verifie") {
    q = q.eq("is_verified", true).or(`verified_until.is.null,verified_until.gte.${today}`)
  } else if (params.verif === "non-verifie") {
    q = q.eq("is_verified", false).is("rejection_reason", null).or(`verified_until.is.null,verified_until.gte.${today}`)
  } else if (params.verif === "refuse") {
    q = q.not("rejection_reason", "is", null)
  } else if (params.verif === "expire") {
    q = q.is("rejection_reason", null).lt("verified_until", today)
  }
  if (search.kind === "name") q = q.ilike("full_name", `%${escapeLike(search.value)}%`)
  else if (search.kind === "phone") q = q.eq("phone", search.value)
  else if (search.kind === "email") q = q.in("user_id", emailIds)
  return q
}

/** Identifiants dont l'e-mail correspond (exact ou préfixe) : lecture paginée des comptes d'authentification. */
async function findUserIdsByEmail(service, wanted) {
  const ids = []
  for (let page = 1; page <= AUTH_MAX_PAGES; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })
    if (error) throw new Error("Lecture des comptes impossible.")
    const users = data?.users ?? []
    for (const user of users) {
      if (emailMatches(user.email, wanted)) ids.push(user.id)
      if (ids.length >= EMAIL_MATCH_LIMIT) return ids
    }
    if (users.length < AUTH_PAGE_SIZE) break
  }
  return ids
}

/** Adresses des seules lignes affichées, lues par petits groupes en parallèle. */
async function readEmails(service, ids) {
  const emails = new Map()
  for (const group of inChunks(ids, EMAIL_PARALLEL)) {
    await Promise.all(
      group.map(async (id) => {
        try {
          const { data } = await service.auth.admin.getUserById(id)
          if (data?.user?.email) emails.set(id, data.user.email)
        } catch {
          // adresse indisponible : la ligne s'affiche sans e-mail
        }
      }),
    )
  }
  return emails
}

/** Étudiants (parmi `ids`) qui ont envoyé une carte : booléen seulement, jamais l'adresse de la carte. */
async function readCardHolders(service, ids) {
  const holders = new Set()
  for (const chunk of inChunks(ids)) {
    const { data, error } = await service.from("student_profiles").select("user_id").in("user_id", chunk).not("card_url", "is", null)
    if (error) throw new Error("Lecture des cartes impossible.")
    for (const row of data ?? []) holders.add(row.user_id)
  }
  return holders
}

async function readBalances(service, ids) {
  const balances = new Map()
  for (const chunk of inChunks(ids)) {
    const { data, error } = await service.from("wallets").select("user_id, balance").in("user_id", chunk)
    if (error) throw new Error("Lecture des portefeuilles impossible.")
    for (const row of data ?? []) balances.set(row.user_id, Number(row.balance) || 0)
  }
  return balances
}

async function countRole(service, role) {
  const { count, error } = await service.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", role)
  if (error) throw new Error("Lecture des comptes impossible.")
  return count ?? 0
}

/**
 * Liste des comptes (AD03) : 20 par page, filtres en liste fermée, recherche par nom, e-mail ou téléphone. Aucune
 * donnée privée hors besoin : ni téléphone, ni jeton, ni motif. Une page hors limites renvoie la dernière page.
 * @param {Record<string, string|string[]|undefined>} [searchParams]
 */
export async function listAdminUsers(searchParams) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { admin, service } = ctx

  const params = parseUserParams(searchParams)
  const search = detectSearch(params.q)
  const today = todayInBenin()
  try {
    const emailIds = search.kind === "email" ? await findUserIdsByEmail(service, search.value) : []
    const [students, clients, admins] = await Promise.all([
      countRole(service, "student"),
      countRole(service, "client"),
      countRole(service, "admin"),
    ])
    const totals = { students, clients, admins, all: students + clients + admins }

    const empty = search.kind === "email" && emailIds.length === 0
    let page = params.page
    let total = 0
    let profiles = []
    if (!empty) {
      const read = async (target) => {
        const from = (target - 1) * USERS_PAGE_SIZE
        const query = applyFilters(
          service.from("profiles").select(LIST_COLUMNS, { count: "exact" }),
          params,
          search,
          today,
          emailIds,
        )
          .order("created_at", { ascending: false })
          .order("user_id", { ascending: true })
          .range(from, from + USERS_PAGE_SIZE - 1)
        const { data, error, count } = await query
        if (error) throw new Error("Lecture des comptes impossible.")
        return { rows: data ?? [], count: count ?? 0 }
      }
      let result = await read(page)
      const last = lastPage(result.count)
      if (result.rows.length === 0 && result.count > 0 && page > last) {
        page = last
        result = await read(page)
      }
      total = result.count
      profiles = result.rows
    }

    const ids = profiles.map((p) => p.user_id)
    const studentIds = profiles.filter((p) => p.role === "student").map((p) => p.user_id)
    const walletIds = profiles.filter((p) => p.role !== "admin").map((p) => p.user_id)
    const [emails, holders, balances] = await Promise.all([
      readEmails(service, ids),
      readCardHolders(service, studentIds),
      readBalances(service, walletIds),
    ])

    const rows = profiles.map((p) => {
      const tab =
        p.role === "student"
          ? classifyDossier(
              {
                isVerified: p.is_verified === true,
                verifiedUntil: p.verified_until,
                rejectionReason: p.rejection_reason,
                hasCard: holders.has(p.user_id),
                submittedAt: p.verification_submitted_at,
              },
              today,
            )
          : null
      return {
        userId: p.user_id,
        name: typeof p.full_name === "string" ? p.full_name.trim() : "",
        email: emails.get(p.user_id) ?? null,
        role: p.role,
        verification: verificationLabel(p.role, tab),
        isSuspended: p.is_suspended === true,
        city: p.city ?? null,
        balance: p.role === "admin" ? null : (balances.get(p.user_id) ?? 0),
        missions: p.role === "admin" ? null : (Number(p.missions_done) || 0),
        createdAt: p.created_at ?? null,
        isSelf: p.user_id === admin.userId,
      }
    })

    return {
      params: { ...params, page },
      requestedPage: params.page,
      pageClamped: page !== params.page,
      total,
      pageCount: lastPage(total),
      pageSize: USERS_PAGE_SIZE,
      totals,
      rows,
      today,
    }
  } catch (err) {
    console.error("[admin-users] liste:", err?.message)
    return { error: ERR_READ }
  }
}

/** Compte d'une page de fiche : liste de missions (client : publiées, étudiant : retenu), 20 plus récentes. */
async function readMissions(service, profile) {
  const column = profile.role === "client" ? "client_id" : "selected_student_id"
  if (profile.role === "admin") return { rows: [], count: 0 }
  const { data, error, count } = await service
    .from("missions")
    .select(MISSION_COLUMNS, { count: "exact" })
    .eq(column, profile.user_id)
    .order("created_at", { ascending: false })
    .limit(DETAIL_LIST_LIMIT)
  if (error) throw new Error("Lecture des missions impossible.")
  return { rows: data ?? [], count: count ?? 0 }
}

async function readWallet(service, userId) {
  const [walletRes, txRes] = await Promise.all([
    service.from("wallets").select("balance, reserved").eq("user_id", userId).maybeSingle(),
    service
      .from("wallet_transactions")
      .select("id, type, amount, created_at, mission_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(DETAIL_LIST_LIMIT),
  ])
  if (walletRes.error || txRes.error) throw new Error("Lecture du portefeuille impossible.")
  return {
    balance: walletRes.data ? Number(walletRes.data.balance) || 0 : null,
    reserved: walletRes.data ? Number(walletRes.data.reserved) || 0 : null,
    transactions: (txRes.data ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount) || 0,
      createdAt: t.created_at ?? null,
      missionId: t.mission_id ?? null,
    })),
  }
}

/**
 * Fiche d'un compte (AD04). Téléphone et e-mail ne sont lus qu'ici, pour l'administrateur. Un identifiant invalide ou
 * inconnu donne `{ notFound: true }` (la page répond 404). Le jeton de notification n'est jamais lu.
 * @param {string} id
 * @param {{ onglet?: string }} [options]
 */
export async function getAdminUserDetail(id, { onglet } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { admin, service } = ctx

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { notFound: true }
  const userId = parsed.data.toLowerCase()
  const tab = parseUserTab(onglet)
  const today = todayInBenin()
  try {
    const { data: profile, error } = await service.from("profiles").select(DETAIL_COLUMNS).eq("user_id", userId).maybeSingle()
    if (error) throw new Error("Lecture du profil impossible.")
    if (!profile) return { notFound: true }

    const isStudent = profile.role === "student"
    const [authRes, studentRes, missions, applicationsRes, wallet] = await Promise.all([
      service.auth.admin.getUserById(userId),
      isStudent
        ? service.from("student_profiles").select("school, level, card_url").eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      readMissions(service, profile),
      isStudent
        ? service.from("applications").select("id", { count: "exact", head: true }).eq("student_id", userId)
        : Promise.resolve({ count: null, error: null }),
      profile.role === "admin" ? Promise.resolve(null) : readWallet(service, userId),
    ])
    if (studentRes.error || applicationsRes.error) throw new Error("Lecture du profil étudiant impossible.")

    const hasCard = Boolean(studentRes.data?.card_url)
    const verificationTab = isStudent
      ? classifyDossier(
          {
            isVerified: profile.is_verified === true,
            verifiedUntil: profile.verified_until,
            rejectionReason: profile.rejection_reason,
            hasCard,
            submittedAt: profile.verification_submitted_at,
          },
          today,
        )
      : null

    return {
      onglet: tab,
      today,
      user: {
        userId,
        name: typeof profile.full_name === "string" ? profile.full_name.trim() : "",
        email: authRes?.data?.user?.email ?? null,
        phone: profile.phone ?? null,
        role: profile.role,
        city: profile.city ?? null,
        isSuspended: profile.is_suspended === true,
        isSelf: userId === admin.userId,
        createdAt: profile.created_at ?? null,
        missionsDone: Number(profile.missions_done) || 0,
        rating: Number(profile.rating) || 0,
        school: studentRes.data?.school ?? null,
        level: studentRes.data?.level ?? null,
      },
      verification: isStudent
        ? {
            tab: verificationTab,
            label: verificationLabel("student", verificationTab),
            verifiedUntil: profile.verified_until ?? null,
            rejectionReason: profile.rejection_reason ?? null,
            submittedAt: profile.verification_submitted_at ?? null,
            hasCard,
          }
        : null,
      missions: {
        count: missions.count,
        rows: missions.rows.map((m) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          status: m.status,
          budget: Number(m.budget) || 0,
          city: m.city ?? null,
          deadline: m.deadline ?? null,
          createdAt: m.created_at ?? null,
        })),
        role: profile.role,
      },
      applicationsCount: applicationsRes.count ?? null,
      wallet,
    }
  } catch (err) {
    console.error("[admin-users] fiche:", err?.message)
    return { error: ERR_READ }
  }
}

function revalidateUsers(userId) {
  revalidatePath("/admin/users")
  revalidatePath(`/admin/users/${userId}`)
}

/**
 * Change l'état de suspension d'un compte. Refus : identifiant ou motif invalide, soi-même, compte administrateur,
 * compte déjà dans l'état demandé. Écriture conditionnelle (rôle non administrateur, état attendu) sur une ligne.
 * Aucun e-mail n'est envoyé au compte concerné ; une réactivation lui laisse une notification in-app.
 */
async function changeSuspension(service, admin, id, reason, suspend) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { error: ERR_INVALID }
  const parsedReason = reasonSchema.safeParse(reason)
  if (!parsedReason.success) return { error: parsedReason.error.issues[0]?.message ?? "Indiquez un motif." }
  const userId = parsedId.data.toLowerCase()
  if (userId === admin.userId) return { error: ERR_SELF }

  const action = suspend ? "user.suspend" : "user.reactivate"
  try {
    const { data: target, error } = await service
      .from("profiles")
      .select("user_id, role, is_suspended")
      .eq("user_id", userId)
      .maybeSingle()
    if (error) {
      console.error(`[admin-users] ${action} lecture:`, error.message)
      return { error: ERR_WRITE }
    }
    if (!target) return { error: ERR_INVALID }
    if (target.role === "admin") return { error: ERR_ADMIN }
    const current = target.is_suspended === true
    if (current === suspend) return { error: suspend ? ERR_ALREADY_SUSPENDED : ERR_NOT_SUSPENDED }

    const { data, error: writeError } = await service
      .from("profiles")
      .update({ is_suspended: suspend })
      .eq("user_id", userId)
      .neq("role", "admin")
      .eq("is_suspended", current)
      .select("user_id")
    if (writeError) {
      console.error(`[admin-users] ${action}:`, writeError.message)
      return { error: ERR_WRITE }
    }
    if (!Array.isArray(data) || data.length !== 1) return { error: suspend ? ERR_ALREADY_SUSPENDED : ERR_NOT_SUSPENDED }

    logAdminAction({
      adminId: admin.userId,
      action,
      targetId: userId,
      before: { isSuspended: current },
      after: { isSuspended: suspend },
      reason: parsedReason.data,
    })
    // Notification in-app à la réactivation seulement (un compte suspendu ne peut plus se connecter).
    if (!suspend) {
      try {
        await notify({ recipientId: userId, ...accountReactivated({ at: new Date() }) })
      } catch {
        console.error("[admin-users] notification non écrite")
      }
    }
    revalidateUsers(userId)
    return { success: true }
  } catch (err) {
    console.error(`[admin-users] ${action}:`, err?.message)
    return { error: ERR_WRITE }
  }
}

/**
 * Suspend un compte jusqu'à réactivation manuelle. Motif obligatoire (5 à 500 caractères) gardé dans le journal.
 * @param {string} id
 * @param {{ reason?: string }} [options]
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function suspendAccount(id, { reason } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  return changeSuspension(ctx.service, ctx.admin, id, reason, true)
}

/**
 * Réactive un compte suspendu. Motif obligatoire gardé dans le journal.
 * @param {string} id
 * @param {{ reason?: string }} [options]
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function reactivateAccount(id, { reason } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  return changeSuspension(ctx.service, ctx.admin, id, reason, false)
}
