"use server"

// @ds-screen RD-STUDENT-01
// Plafonds de lecture connus :
// - les candidatures de l'étudiant sont lues par pages de 1000 lignes (plafond PostgREST), 5 pages au plus ;
//   les compteurs des onglets sont exacts en dessous de 5000 candidatures ;
// - les avis de l'onglet Terminées sont lus par lots de 100 missions de l'onglet (filtre `mission_id`), donc sans
//   plafond de 1000 lignes ;
// - une mission que la sécurité de la base ne montre plus à l'étudiant (attribuée à un autre) n'a ni titre ni
//   montant : la candidature reste comptée dans « Non retenues », sans lien vers la mission.

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { escrowSplit } from "@/lib/app/money"
import { publicDisplayName, firstName } from "@/lib/vitrine/public-name"
import { APPLICATION_TABS, applicationTab, defaultApplicationTab } from "@/lib/student-space/applications-tabs"
import { readAcceptedAt, validAcceptedAt } from "@/lib/actions/application-accepted-core"

const ERR_APPLICATIONS = "Impossible de charger vos candidatures."

const PAGE_SIZE = 1000
const MAX_PAGES = 5
const NAMES_CHUNK = 100
const RECENT_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @typedef {Object} ApplicationRow
 * @property {string} id Identifiant de la candidature
 * @property {string|null} missionId null : mission devenue illisible pour l'étudiant
 * @property {string} title
 * @property {string|null} type
 * @property {string|null} city
 * @property {number} budget
 * @property {number} net Part de l'étudiant (escrowSplit)
 * @property {string|null} deadline
 * @property {"open"|"in_progress"|"done"|"cancelled"|null} missionStatus
 * @property {"pending"|"accepted"|"rejected"} status
 * @property {string} appliedAt
 * @property {string} updatedAt Date du dernier changement de la candidature (tri seulement, jamais une date de rétention)
 * @property {string|null} acceptedAt Date de rétention posée par la base (applications.accepted_at) ; null hors onglet
 *   En cours, colonne absente, ligne ancienne sans date ou date invalide
 * @property {string} clientName Prénom et initiale du client ("" si inconnu)
 * @property {string} clientFirst Prénom du client ("" si inconnu)
 * @property {{ rating: number|null }|null} review Avis laissé par l'étudiant (onglet Terminées seulement)
 */

/**
 * @typedef {Object} StudentApplicationsData
 * @property {"en-attente"|"en-cours"|"terminees"|"non-retenues"} tab Onglet affiché (invalide : premier non vide)
 * @property {Record<string, number>} counts Compteurs exacts des quatre onglets
 * @property {number} total
 * @property {ApplicationRow[]} rows Lignes de l'onglet affiché, la plus récente d'abord
 * @property {{ total: number, count: number }} escrow Part nette bloquée en séquestre et nombre de missions retenues en cours
 * @property {null|{ missionId: string, title: string, city: string|null, deadline: string|null, net: number,
 *   clientName: string, clientFirst: string, acceptedAt: string|null }} highlight Retenue des 7 derniers jours,
 *   ou retenue dont la date n'est pas disponible (acceptedAt null : la carte s'affiche sans jour ni heure)
 */

/**
 * Dates de rétention des candidatures en cours, lues dans une requête séparée (colonne facultative tant que le
 * script 91 n'est pas appliqué). Jamais bloquant : colonne absente ou toute autre erreur = aucune date, la page
 * se rend (journal par code seulement). `updated_at` n'est jamais une source de date de rétention.
 * @returns {Promise<Map<string, string>>} identifiant de candidature -> date valide (les autres sont absents)
 */
async function readRetentionDates(supabase, userId, applications) {
  const dates = new Map()
  if (applications.length === 0) return dates
  // Client restreint : la lecture partagée est filtrée sur l'étudiant de la session en plus de la RLS.
  const ownApplications = { from: (table) => ({ select: (columns) => supabase.from(table).select(columns).eq("student_id", userId) }) }
  try {
    const { available, byId } = await readAcceptedAt(ownApplications, applications.map((a) => a.id))
    if (!available) return dates
    for (const a of applications) {
      const at = byId.has(a.id) ? validAcceptedAt(byId.get(a.id)) : null
      if (at) dates.set(a.id, at)
    }
  } catch (err) {
    console.error("[getStudentApplicationsView] date de retenue", err?.code ?? "inconnu")
  }
  return dates
}

async function readApplications(supabase, userId) {
  const all = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await supabase
      .from("applications")
      .select("id, mission_id, status, created_at, updated_at, missions(title, type, city, budget, status, deadline, selected_student_id, client_id)")
      .eq("student_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error("[getStudentApplicationsView] candidatures", error.message)
      return null
    }
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return all
}

async function readClientNames(supabase, ids) {
  const names = new Map()
  for (let i = 0; i < ids.length; i += NAMES_CHUNK) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids.slice(i, i + NAMES_CHUNK))
    if (error) {
      console.error("[getStudentApplicationsView] clients", error.message)
      return null
    }
    for (const p of data ?? []) names.set(p.user_id, p.full_name)
  }
  return names
}

/**
 * Candidatures de l'étudiant connecté (E04) : lignes de l'onglet demandé, compteurs des quatre onglets, séquestre
 * total et candidature retenue récemment. `requireRole(["student"])` d'abord ; chaque lecture est filtrée sur
 * l'étudiant de la session (aucune candidature d'un autre), colonnes explicites, client public seulement (prénom
 * et initiale, jamais téléphone ni email), erreurs neutres.
 * @param {{ onglet?: string|string[] }} [params] Valeur brute de `?onglet=`
 * @returns {Promise<{ data: StudentApplicationsData } | { error: string }>}
 */
export async function getStudentApplicationsView({ onglet } = {}) {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: ERR_APPLICATIONS }
    const { supabase, user } = auth

    const applications = await readApplications(supabase, user.id)
    if (!applications) return { error: ERR_APPLICATIONS }

    const groups = Object.fromEntries(APPLICATION_TABS.map((t) => [t.id, []]))
    for (const app of applications) {
      // Mission illisible : jamais classée « en attente » ni « en cours ».
      groups[app.missions ? applicationTab(app, user.id) : "non-retenues"].push(app)
    }
    const counts = Object.fromEntries(APPLICATION_TABS.map((t) => [t.id, groups[t.id].length]))
    const tab = defaultApplicationTab(onglet, counts)

    // Séquestre : part nette des missions en cours où l'étudiant est retenu.
    const inProgress = groups["en-cours"].filter((a) => a.missions.status === "in_progress")
    const escrow = {
      total: inProgress.reduce((sum, a) => sum + escrowSplit(a.missions.budget).student, 0),
      count: inProgress.length,
    }

    // Date de rétention : accepted_at seulement. Retenue récente = la première dont la date a 0 à 7 jours ; à
    // défaut, la première dont la date n'est pas disponible (la carte s'affiche alors sans jour ni heure).
    // Une retenue datée de plus de 7 jours n'a pas de carte.
    const retainedAt = await readRetentionDates(supabase, user.id, groups["en-cours"])
    const now = Date.now()
    const recent =
      inProgress.find((a) => {
        const at = retainedAt.get(a.id)
        const age = at ? now - new Date(at).getTime() : -1
        return age >= 0 && age <= RECENT_DAYS * DAY_MS
      }) ?? inProgress.find((a) => !retainedAt.has(a.id))

    const shown = groups[tab]
    const clientIds = [...new Set([...shown, ...(recent ? [recent] : [])].map((a) => a.missions?.client_id).filter(Boolean))]
    const names = clientIds.length > 0 ? await readClientNames(supabase, clientIds) : new Map()
    if (!names) return { error: ERR_APPLICATIONS }

    // Avis déjà laissés (onglet Terminées) : filtrés sur l'étudiant ET sur les missions de l'onglet, par lots.
    const reviews = new Map()
    if (tab === "terminees" && shown.length > 0) {
      const missionIds = [...new Set(shown.map((a) => a.mission_id))]
      for (let i = 0; i < missionIds.length; i += NAMES_CHUNK) {
        const { data, error } = await supabase
          .from("reviews")
          .select("mission_id, rating")
          .eq("reviewer_id", user.id)
          .in("mission_id", missionIds.slice(i, i + NAMES_CHUNK))
        if (error) {
          console.error("[getStudentApplicationsView] avis", error.message)
          return { error: ERR_APPLICATIONS }
        }
        for (const r of data ?? []) reviews.set(r.mission_id, { rating: Number(r.rating) || null })
      }
    }

    const nameOf = (clientId) => {
      const full = names.get(clientId)
      return {
        clientName: full ? publicDisplayName(full) : "",
        clientFirst: full ? firstName(full, { fallback: "" }) : "",
      }
    }

    const rows = shown.map((a) => {
      const m = a.missions
      return {
        id: a.id,
        missionId: m ? a.mission_id : null,
        title: m?.title ?? "Mission indisponible",
        type: m?.type ?? null,
        city: m?.city ?? null,
        budget: m ? Number(m.budget) || 0 : 0,
        net: m ? escrowSplit(m.budget).student : 0,
        deadline: m?.deadline ?? null,
        missionStatus: m?.status ?? null,
        status: a.status,
        appliedAt: a.created_at,
        updatedAt: a.updated_at,
        acceptedAt: retainedAt.get(a.id) ?? null,
        ...nameOf(m?.client_id),
        review: reviews.get(a.mission_id) ?? null,
      }
    })

    const highlight = recent
      ? {
          missionId: recent.mission_id,
          title: recent.missions.title,
          city: recent.missions.city ?? null,
          deadline: recent.missions.deadline ?? null,
          net: escrowSplit(recent.missions.budget).student,
          ...nameOf(recent.missions.client_id),
          acceptedAt: retainedAt.get(recent.id) ?? null,
        }
      : null

    return { data: { tab, counts, total: applications.length, rows, escrow, highlight } }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentApplicationsView]", err)
    return { error: ERR_APPLICATIONS }
  }
}
