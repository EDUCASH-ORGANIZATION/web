"use server"

import { requireRole } from "@/lib/auth/require-role"
import { isUuid } from "@/lib/vitrine/ids"
import { firstName } from "@/lib/vitrine/public-name"

const ERR_LOAD = "Impossible de charger la mission."
const ERR_LOAD_CANDIDATE = "Impossible de charger ce candidat."

// Colonnes explicites : jamais de select("*") sur profiles ni student_profiles, aucune colonne privée
// (téléphone, card_url, motif de refus, jeton de notification...).
const MISSION_COLUMNS =
  "id, title, description, type, city, budget, urgency, deadline, status, created_at, selected_student_id"
const APPLICATION_COLUMNS = "id, student_id, message, status, created_at"
const PUBLIC_PROFILE_FIELDS =
  "user_id, full_name, avatar_url, city, rating, missions_done, is_verified, verified_until"
const PUBLIC_STUDENT_FIELDS = "user_id, school, level, skills"
const LEDGER_TYPES = ["reserve", "release", "commission", "refund"]
const APPLICATIONS_LIMIT = 200
const CANDIDATE_REVIEWS_LIMIT = 20

/**
 * @typedef {Object} DetailStudent Profil public d'un étudiant (colonnes publiques seulement).
 * @property {string} id user_id de l'étudiant
 * @property {string} fullName Nom complet (chaîne vide si inconnu)
 * @property {string|null} avatarUrl
 * @property {string|null} city
 * @property {number} rating Note moyenne, 0 si aucun avis
 * @property {number} missionsDone
 * @property {boolean} isVerified Colonne brute `is_verified`
 * @property {string|null} verifiedUntil "AAAA-MM-JJ" ou null
 * @property {string|null} school
 * @property {string|null} level
 * @property {string[]} skills Valeurs de MISSION_TYPES, à afficher par missionTypeLabel()
 */

/**
 * @typedef {Object} ClientMissionDetail Forme de `detail`, consommée par les vues C04 à C11.
 * @property {Object} mission Mission du client connecté (jamais celle d'un autre client)
 * @property {string} mission.id
 * @property {string} mission.title
 * @property {string} mission.description
 * @property {string} mission.type Valeur en base : l'afficher par missionTypeLabel()
 * @property {string|null} mission.city
 * @property {number} mission.budget Montant en FCFA (jamais de commission en dur : escrowSplit)
 * @property {"low"|"medium"|"high"|null} mission.urgency
 * @property {string|null} mission.deadline "AAAA-MM-JJ" ou null
 * @property {"open"|"in_progress"|"done"|"cancelled"} mission.status
 * @property {string} mission.createdAt Date ISO de publication
 * @property {string|null} mission.selectedStudentId
 * @property {Array<{
 *   id: string,
 *   studentId: string,
 *   status: "pending"|"accepted"|"rejected",
 *   message: string|null,
 *   createdAt: string,
 *   student: DetailStudent
 * }>} applications Candidatures de CETTE mission, les plus récentes d'abord (200 au plus)
 * @property {DetailStudent|null} selectedStudent Étudiant retenu (mission.selectedStudentId), sinon null
 * @property {Array<{ type: "reserve"|"release"|"commission"|"refund", amount: number, createdAt: string }>} ledger
 *   Mouvements du grand livre de CETTE mission pour le client, du plus ancien au plus récent.
 *   `amount` est celui stocké en base (le signe n'est pas supposé : utiliser Math.abs).
 * @property {{ id: string, rating: number, comment: string|null, createdAt: string }|null} review
 *   Avis déjà donné par le client pour cette mission, sinon null
 */

/**
 * @typedef {Object} CandidateProfile Forme de `candidate` (tiroir C05).
 * @property {string} studentId
 * @property {string} applicationId
 * @property {"pending"|"accepted"|"rejected"} applicationStatus
 * @property {string|null} message Message de candidature
 * @property {string} appliedAt Date ISO
 * @property {DetailStudent} student
 * @property {number} reviewsTotal Nombre total d'avis reçus
 * @property {Array<{ id: string, rating: number, comment: string|null, createdAt: string, authorFirstName: string }>} reviews
 *   Avis reçus (20 au plus, récents d'abord), l'auteur réduit à son prénom
 */

function toStudent(userId, profile, studentProfile) {
  return {
    id: userId,
    fullName: typeof profile?.full_name === "string" ? profile.full_name : "",
    avatarUrl: profile?.avatar_url ?? null,
    city: profile?.city ?? null,
    rating: Number(profile?.rating) || 0,
    missionsDone: Number(profile?.missions_done) || 0,
    isVerified: profile?.is_verified === true,
    verifiedUntil: profile?.verified_until ?? null,
    school: studentProfile?.school ?? null,
    level: studentProfile?.level ?? null,
    skills: Array.isArray(studentProfile?.skills) ? studentProfile.skills : [],
  }
}

/**
 * Lit les profils publics des étudiants indiqués. Une erreur de lecture lève une erreur neutre.
 * @returns {Promise<Map<string, DetailStudent>>}
 */
async function loadStudents(supabase, ids, message) {
  const unique = [...new Set(ids.filter(Boolean))]
  const students = new Map()
  if (unique.length === 0) return students

  const [profiles, studentProfiles] = await Promise.all([
    supabase.from("profiles").select(PUBLIC_PROFILE_FIELDS).in("user_id", unique),
    supabase.from("student_profiles").select(PUBLIC_STUDENT_FIELDS).in("user_id", unique),
  ])
  if (profiles.error || studentProfiles.error) {
    console.error("[client-mission-detail] lecture des profils", profiles.error?.message ?? studentProfiles.error?.message)
    throw new Error(message)
  }

  const profileById = new Map((profiles.data ?? []).map((p) => [p.user_id, p]))
  const studentById = new Map((studentProfiles.data ?? []).map((s) => [s.user_id, s]))
  for (const id of unique) {
    students.set(id, toStudent(id, profileById.get(id), studentById.get(id)))
  }
  return students
}

/**
 * Charge une mission du client connecté, ses candidatures, l'étudiant retenu, le grand livre de la mission
 * et l'avis déjà donné. `requireRole(["client"])` d'abord ; la propriété est vérifiée (`client_id`).
 * Une mission inexistante, d'un autre client, un identifiant mal formé ou un appelant refusé donnent `null`
 * (la page répond 404). Une lecture en échec lève une erreur neutre (error.js), jamais un message SQL.
 *
 * @param {string} id Identifiant de la mission
 * @returns {Promise<ClientMissionDetail | null>}
 */
export async function getClientMissionDetail(id) {
  const auth = await requireRole(["client"])
  if (auth.error) return null
  if (!isUuid(id)) return null
  const { supabase, user } = auth

  const { data: mission, error } = await supabase
    .from("missions")
    .select(MISSION_COLUMNS)
    .eq("id", id)
    .eq("client_id", user.id)
    .maybeSingle()
  if (error) {
    console.error("[getClientMissionDetail] mission", error.message)
    throw new Error(ERR_LOAD)
  }
  if (!mission) return null

  // Tout ce qui suit est filtré par l'identifiant d'une mission dont la propriété est établie.
  const [applicationsRes, ledgerRes, reviewRes] = await Promise.all([
    supabase
      .from("applications")
      .select(APPLICATION_COLUMNS)
      .eq("mission_id", mission.id)
      .order("created_at", { ascending: false })
      .limit(APPLICATIONS_LIMIT),
    supabase
      .from("wallet_transactions")
      .select("type, amount, created_at")
      .eq("user_id", user.id)
      .eq("mission_id", mission.id)
      .in("type", LEDGER_TYPES)
      .order("created_at", { ascending: true }),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at")
      .eq("mission_id", mission.id)
      .eq("reviewer_id", user.id)
      .limit(1)
      .maybeSingle(),
  ])
  if (applicationsRes.error || ledgerRes.error || reviewRes.error) {
    console.error(
      "[getClientMissionDetail] lecture",
      applicationsRes.error?.message ?? ledgerRes.error?.message ?? reviewRes.error?.message,
    )
    throw new Error(ERR_LOAD)
  }

  const rawApplications = applicationsRes.data ?? []
  const students = await loadStudents(
    supabase,
    [...rawApplications.map((a) => a.student_id), mission.selected_student_id],
    ERR_LOAD,
  )

  const review = reviewRes.data
  return {
    mission: {
      id: mission.id,
      title: mission.title,
      description: mission.description ?? "",
      type: mission.type,
      city: mission.city ?? null,
      budget: Number(mission.budget) || 0,
      urgency: mission.urgency ?? null,
      deadline: mission.deadline ?? null,
      status: mission.status,
      createdAt: mission.created_at,
      selectedStudentId: mission.selected_student_id ?? null,
    },
    applications: rawApplications.map((a) => ({
      id: a.id,
      studentId: a.student_id,
      status: a.status,
      message: a.message ?? null,
      createdAt: a.created_at,
      student: students.get(a.student_id),
    })),
    selectedStudent: mission.selected_student_id ? (students.get(mission.selected_student_id) ?? null) : null,
    ledger: (ledgerRes.data ?? []).map((m) => ({
      type: m.type,
      amount: Number(m.amount) || 0,
      createdAt: m.created_at,
    })),
    review: review
      ? { id: review.id, rating: Number(review.rating) || 0, comment: review.comment ?? null, createdAt: review.created_at }
      : null,
  }
}

/**
 * Profil public d'un candidat, pour le tiroir de la mission. `requireRole(["client"])` d'abord ; le candidat
 * n'est lisible que si la mission est au client ET si l'étudiant a candidaté à CETTE mission : sinon `null`
 * (refus neutre, aucune indication sur l'existence du profil). Colonnes publiques seulement.
 *
 * @param {string} missionId
 * @param {string} studentId
 * @returns {Promise<CandidateProfile | null>}
 */
export async function getCandidateProfile(missionId, studentId) {
  const auth = await requireRole(["client"])
  if (auth.error) return null
  if (!isUuid(missionId) || !isUuid(studentId)) return null
  const { supabase, user } = auth

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("id")
    .eq("id", missionId)
    .eq("client_id", user.id)
    .maybeSingle()
  if (missionError) {
    console.error("[getCandidateProfile] mission", missionError.message)
    throw new Error(ERR_LOAD_CANDIDATE)
  }
  if (!mission) return null

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select(APPLICATION_COLUMNS)
    .eq("mission_id", mission.id)
    .eq("student_id", studentId)
    .maybeSingle()
  if (applicationError) {
    console.error("[getCandidateProfile] candidature", applicationError.message)
    throw new Error(ERR_LOAD_CANDIDATE)
  }
  if (!application) return null

  const [students, reviewsRes] = await Promise.all([
    loadStudents(supabase, [studentId], ERR_LOAD_CANDIDATE),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_id", { count: "exact" })
      .eq("reviewed_id", studentId)
      .order("created_at", { ascending: false })
      .limit(CANDIDATE_REVIEWS_LIMIT),
  ])
  if (reviewsRes.error) {
    console.error("[getCandidateProfile] avis", reviewsRes.error.message)
    throw new Error(ERR_LOAD_CANDIDATE)
  }

  const rawReviews = reviewsRes.data ?? []
  const authors = await loadAuthorNames(supabase, rawReviews.map((r) => r.reviewer_id))

  return {
    studentId,
    applicationId: application.id,
    applicationStatus: application.status,
    message: application.message ?? null,
    appliedAt: application.created_at,
    student: students.get(studentId),
    reviewsTotal: reviewsRes.count ?? rawReviews.length,
    reviews: rawReviews.map((r) => ({
      id: r.id,
      rating: Number(r.rating) || 0,
      comment: r.comment ?? null,
      createdAt: r.created_at,
      authorFirstName: firstName(authors.get(r.reviewer_id)),
    })),
  }
}

// Noms complets des auteurs d'avis (colonne publique `full_name` seule), pour n'en garder que le prénom.
async function loadAuthorNames(supabase, ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data, error } = await supabase.from("profiles").select("user_id, full_name").in("user_id", unique)
  if (error) {
    console.error("[getCandidateProfile] auteurs d'avis", error.message)
    // Choix assumé : les noms sont décoratifs. Une erreur ici renvoie une Map vide (prénom par défaut) au lieu
    // de faire échouer tout le profil candidat, dont les avis eux-mêmes ont bien été lus.
    return new Map()
  }
  return new Map((data ?? []).map((p) => [p.user_id, p.full_name]))
}
