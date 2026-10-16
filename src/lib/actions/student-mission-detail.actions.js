// @ds-screen RD-STUDENT-01
"use server"

import { requireRole } from "@/lib/auth/require-role"
import { ANONYMOUS_CLIENT_NAME } from "@/lib/constants/client-name"
import { readAcceptedAt, validAcceptedAt } from "@/lib/actions/application-accepted-core"
import { readCompletionDeclared } from "@/lib/actions/mission-completion-core"
import { getMyProfile, getMyStudentProfile } from "@/lib/actions/profile.actions"
import { purchasesEstimateOf } from "@/lib/app/purchases"
import { isUuid } from "@/lib/vitrine/ids"
import { publicDisplayName } from "@/lib/vitrine/public-name"
import { toProjectAvatarUrl } from "@/lib/storage/owned-paths"
import { notExpiredFilter } from "@/lib/student-space/explore-query"
import { verificationFromRows } from "@/lib/student-space/verification-status"

const ERR_LOAD = "Impossible de charger la mission."
const SIMILAR_LIMIT = 4

// Colonnes explicites seulement (jamais toutes les colonnes), dont id, status et selected_student_id pour décider de
// l'affichage. Aucune colonne privée (téléphone, carte, motif de refus...).
const MISSION_COLUMNS =
  "id, title, description, type, city, budget, urgency, deadline, status, created_at, client_id, selected_student_id, purchases_estimate"
const APPLICATION_COLUMNS = "id, status, message, created_at, updated_at"
const CLIENT_COLUMNS = "full_name, city, avatar_url, rating, missions_done, is_verified"
const SIMILAR_COLUMNS = "id, title, type, city, budget, deadline"
// Seule la ligne `release` du grand livre de l'étudiant (son NET, sous son user_id) est lue : jamais la ligne brute
// du client ni la commission, qui sont sous d'autres user_id.
const LEDGER_COLUMNS = "type, amount, created_at"

/**
 * @typedef {Object} StudentMissionClient Profil public du client (jamais téléphone ni email).
 * @property {string} name Prénom et initiale du nom ("Mawuli A.")
 * @property {string|null} avatarUrl
 * @property {string|null} city
 * @property {number} rating Note moyenne, 0 si aucun avis
 * @property {number} missionsPublished Missions publiées par le client
 * @property {boolean} isVerified
 */

/**
 * @typedef {Object} StudentMissionDetailOpen Mission ouverte (E03), ou mission suivie par l'étudiant retenu (E05).
 * @property {"open"|"selected"} state "open" : mission ouverte ; "selected" : mission non ouverte dont l'étudiant est le retenu
 * @property {Object} mission
 * @property {string} mission.id
 * @property {string} mission.title
 * @property {string} mission.description
 * @property {string} mission.type Valeur en base : l'afficher par missionTypeLabel()
 * @property {string|null} mission.city
 * @property {number} mission.budget Budget du client en FCFA (la part de l'étudiant se calcule par escrowSplit)
 * @property {number|null} mission.purchasesEstimate Estimation indicative des achats en FCFA, non bloquée, null sinon
 * @property {"low"|"medium"|"high"|null} mission.urgency
 * @property {string|null} mission.deadline "AAAA-MM-JJ" ou null
 * @property {"open"|"in_progress"|"done"|"cancelled"} mission.status
 * @property {string} mission.createdAt Date ISO de publication
 * @property {StudentMissionClient} client
 * @property {{ id: string, status: "pending"|"accepted"|"rejected", message: string, createdAt: string, updatedAt: string|null, acceptedAt: string|null }|null} application
 *   Candidature de l'étudiant connecté à cette mission, sinon null. `acceptedAt` : date de rétention posée par la base
 *   (applications.accepted_at), lue pour l'état "selected" seulement ; null si colonne absente, NULL, invalide ou erreur.
 *   `updatedAt` n'est jamais une date de rétention (le client peut la faire varier).
 * @property {boolean} isSelected L'étudiant connecté est le retenu de la mission
 * @property {import("@/lib/student-space/verification-status").VerificationView|null} verification
 *   Statut de vérification calculé côté serveur (jamais de colonne brute) ; null pour une mission suivie ("selected")
 * @property {Array<{ type: "release", amount: number, createdAt: string }>} ledger
 *   Lignes du grand livre de CETTE mission sous le user_id de l'étudiant (release = son NET), vide hors "selected"
 * @property {{ id: string, rating: number, comment: string|null, createdAt: string }|null} review
 *   Avis déjà donné par l'étudiant pour cette mission (état "selected" seulement), sinon null
 * @property {{ available: boolean, declaredAt: string|null }} completion
 *   Fin déclarée par l'étudiant (RD-DONE-01), lue pour l'état "selected" seulement. `available: false` quand la
 *   colonne n'existe pas encore en base, et toujours pour l'état "open" ; `declaredAt` : date ISO ou null
 * @property {Array<{ id: string, title: string, type: string, city: string|null, budget: number }>} similar
 *   Missions ouvertes non expirées du même type (4 au plus), hors mission courante
 */

/**
 * @typedef {Object} StudentMissionDetailClosed Mission non ouverte dont l'étudiant n'est pas le retenu : aucun détail.
 * @property {"closed"} state
 * @property {{ id: string }} mission Identifiant seul : ni titre, ni montant, ni message, ni grand livre
 */

/**
 * @typedef {StudentMissionDetailOpen | StudentMissionDetailClosed} StudentMissionDetail
 */

// Lecture tolérante de la fin déclarée : colonne absente -> available:false ; autre erreur -> erreur neutre.
async function readCompletion(supabase, missionId) {
  try {
    const { available, byId } = await readCompletionDeclared(supabase, [missionId])
    // Réponse sans la ligne (filtrée par la RLS, mission réattribuée) : indisponible, jamais un faux « non déclaré ».
    const known = available && byId.has(missionId)
    return { available: known, declaredAt: known ? (byId.get(missionId) ?? null) : null }
  } catch (error) {
    console.error("[getStudentMissionDetail] fin déclarée", error?.code ?? error?.message)
    throw new Error(ERR_LOAD)
  }
}

// Lecture facultative de la date de rétention (accepted_at, posée par la base) : requête séparée, session de l'étudiant
// (RLS). Colonne absente, ligne absente, date invalide ou erreur : null, la page se rend sans date (journal par code seul).
async function readRetainedAt(supabase, application) {
  if (application?.status !== "accepted") return null
  try {
    const { available, byId } = await readAcceptedAt(supabase, [application.id])
    return available && byId.has(application.id) ? validAcceptedAt(byId.get(application.id)) : null
  } catch (error) {
    console.error("[getStudentMissionDetail] date de rétention", error?.code ?? "inconnue")
    return null
  }
}

async function readVerification() {
  const [profileRes, studentRes] = await Promise.all([getMyProfile(), getMyStudentProfile()])
  if (profileRes.error || studentRes.error || !profileRes.profile) {
    console.error(
      "[getStudentMissionDetail] vérification",
      profileRes.error ?? studentRes.error ?? "profil introuvable",
    )
    throw new Error(ERR_LOAD)
  }
  return verificationFromRows(profileRes.profile, studentRes.studentProfile)
}

function toClient(profile) {
  const hasName = typeof profile?.full_name === "string" && profile.full_name.trim() !== ""
  return {
    name: hasName ? publicDisplayName(profile.full_name) : ANONYMOUS_CLIENT_NAME,
    avatarUrl: toProjectAvatarUrl(profile?.avatar_url),
    city: profile?.city ?? null,
    rating: Number(profile?.rating) || 0,
    missionsPublished: Number(profile?.missions_done) || 0,
    isVerified: profile?.is_verified === true,
  }
}

/**
 * Détail d'une mission pour l'étudiant connecté. `requireRole(["student"])` d'abord, puis `isUuid`.
 * Mission inexistante, identifiant mal formé ou appelant refusé : `null` (la page répond 404).
 * Une mission non ouverte dont l'étudiant n'est pas le retenu renvoie SEULEMENT `{ state: "closed", mission: { id } }`.
 * Pour l'étudiant retenu seulement : lignes du grand livre sous son `user_id` et avis déjà donné.
 * Politique RLS des missions (status = 'open', ou client, ou selected_student_id) : un étudiant non retenu ne voit pas
 * une mission qui n'est plus ouverte, il reçoit donc en pratique `null` (404) plutôt que « closed ». L'état `closed`
 * reste le filet de sécurité si la RLS change (notamment à la migration Neon) : il ne renvoie alors que l'identifiant.
 * Une lecture en échec lève une erreur neutre (error.js), jamais un message SQL.
 *
 * @param {string} id
 * @returns {Promise<StudentMissionDetail | null>}
 */
export async function getStudentMissionDetail(id) {
  const auth = await requireRole(["student"])
  if (auth.error) return null
  if (!isUuid(id)) return null
  const { supabase, user } = auth

  // UNE seule lecture : `closed`, `open` et `selected` sont calculés sur la même ligne (aucune fenêtre de course).
  const missionRes = await supabase.from("missions").select(MISSION_COLUMNS).eq("id", id).maybeSingle()
  if (missionRes.error) {
    console.error("[getStudentMissionDetail] mission", missionRes.error.message)
    throw new Error(ERR_LOAD)
  }
  const mission = missionRes.data
  if (!mission) return null

  const isOpen = mission.status === "open"
  const isSelected = mission.selected_student_id === user.id
  if (!isOpen && !isSelected) return { state: "closed", mission: { id: mission.id } }

  const followed = !isOpen && isSelected
  const applicationQuery = supabase
    .from("applications")
    .select(APPLICATION_COLUMNS)
    .eq("mission_id", mission.id)
    .eq("student_id", user.id)
    .maybeSingle()
  const [applicationRes, clientRes, similarRes, ledgerRes, reviewRes, verification, completion, acceptedAt] = await Promise.all([
    applicationQuery,
    supabase.from("profiles").select(CLIENT_COLUMNS).eq("user_id", mission.client_id).maybeSingle(),
    followed
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("missions")
          .select(SIMILAR_COLUMNS)
          .eq("type", mission.type)
          .eq("status", "open")
          .or(notExpiredFilter())
          .neq("id", mission.id)
          .limit(SIMILAR_LIMIT),
    followed
      ? supabase
          .from("wallet_transactions")
          .select(LEDGER_COLUMNS)
          .eq("user_id", user.id)
          .eq("mission_id", mission.id)
          .eq("type", "release")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    followed
      ? supabase
          .from("reviews")
          .select("id, rating, comment, created_at")
          .eq("mission_id", mission.id)
          .eq("reviewer_id", user.id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    followed ? Promise.resolve(null) : readVerification(),
    followed ? readCompletion(supabase, mission.id) : Promise.resolve({ available: false, declaredAt: null }),
    // Dépend de l'id de la candidature : enchaînée sur sa lecture, en parallèle des autres. Étudiant non retenu : aucune lecture.
    followed ? applicationQuery.then((res) => (res.error ? null : readRetainedAt(supabase, res.data))) : Promise.resolve(null),
  ])
  const failure = applicationRes.error ?? clientRes.error ?? similarRes.error ?? ledgerRes.error ?? reviewRes.error
  if (failure) {
    console.error("[getStudentMissionDetail] lecture", failure.message)
    throw new Error(ERR_LOAD)
  }

  const application = applicationRes.data
  const review = reviewRes.data
  return {
    state: followed ? "selected" : "open",
    mission: {
      id: mission.id,
      title: mission.title,
      description: mission.description ?? "",
      type: mission.type,
      city: mission.city ?? null,
      budget: Number(mission.budget) || 0,
      purchasesEstimate: purchasesEstimateOf(mission.purchases_estimate),
      urgency: mission.urgency ?? null,
      deadline: mission.deadline ?? null,
      status: mission.status,
      createdAt: mission.created_at,
    },
    client: toClient(clientRes.data),
    application: application
      ? {
          id: application.id,
          status: application.status,
          message: application.message ?? "",
          createdAt: application.created_at,
          updatedAt: application.updated_at ?? null,
          acceptedAt,
        }
      : null,
    isSelected,
    verification,
    completion,
    ledger: (ledgerRes.data ?? []).map((m) => ({
      type: "release",
      amount: Math.abs(Number(m.amount) || 0),
      createdAt: m.created_at,
    })),
    review: review
      ? { id: review.id, rating: Number(review.rating) || 0, comment: review.comment ?? null, createdAt: review.created_at }
      : null,
    similar: (similarRes.data ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      city: m.city ?? null,
      budget: Number(m.budget) || 0,
    })),
  }
}
