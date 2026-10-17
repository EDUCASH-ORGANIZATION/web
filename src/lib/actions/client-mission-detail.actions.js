"use server"

import { requireRole } from "@/lib/auth/require-role"
import { readCompletionDeclared } from "@/lib/actions/mission-completion-core"
import { getClientPurchaseRequests } from "@/lib/actions/purchase-request.actions"
import { purchasesEstimateOf } from "@/lib/app/purchases"
import { PURCHASE_STATUSES, exceedsEstimate, purchaseTotals } from "@/lib/purchases/requests"
import { isUuid } from "@/lib/vitrine/ids"
import { firstName } from "@/lib/vitrine/public-name"

const ERR_LOAD = "Impossible de charger la mission."
const ERR_LOAD_CANDIDATE = "Impossible de charger ce candidat."

// Colonnes explicites : jamais de select("*") sur profiles ni student_profiles, aucune colonne privée
// (téléphone, card_url, motif de refus, jeton de notification...).
const MISSION_COLUMNS =
  "id, title, description, type, city, budget, urgency, deadline, status, created_at, selected_student_id, purchases_estimate"
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
 * @property {number|null} mission.purchasesEstimate Estimation indicative des achats en FCFA (mission avec achats), null sinon
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
 * @property {ClientMissionPurchases} purchases
 *   Demandes de paiement d'achats (RD-ACHATS-01), lues pour une mission AVEC achats et un étudiant retenu seulement
 */

/**
 * @typedef {{ available: false } | {
 *   available: true,
 *   requests: Array<Object>,
 *   totals: { count: number, requested: number, paid: number, pending: number, reported: number },
 *   exceedsEstimate: boolean,
 *   confirmWarning: { show: boolean, pending: number, reported: number },
 *   costTotal: { service: number, purchasesPaid: number, total: number }|null
 * }} ClientMissionPurchases
 * `available: false` : rien à afficher (mission sans achats ou sans étudiant retenu, script 94 non appliqué, ou
 * demandes illisibles) ; les vues gardent leur rendu actuel, sans erreur.
 * - `requests` : vues de `getClientPurchaseRequests` (numéro d'ordre croissant, annulées sans carte écartées), avec
 *   `status`, `version`, `amount`, `vendorName`, `payeeKind`, `payeeNumber` (numéro à payer), photos signées 120 s,
 *   `actions` (allowedActions du client) et `alreadyReportedByMe` ; aucun chemin de fichier ;
 * - `totals` : `requested` (annulées exclues), `paid` (payées et reçues, payées en direct HORS séquestre), `pending`,
 *   `reported` ; l'estimation (`mission.purchasesEstimate`) n'y est jamais additionnée ; `exceedsEstimate` : demandé au-delà
 *   de 1,5 fois l'estimation (simple avertissement) ;
 * - `confirmWarning` (C09) : `show` vrai quand la mission est en cours et qu'au moins une demande est en attente ou
 *   signalée ; avertit sans jamais bloquer la confirmation de fin ;
 * - `costTotal` (C11, D7, reçu seulement) : mission terminée avec au moins un achat payé. `service` est le montant de la
 *   mission (budget), `purchasesPaid` la somme des demandes payées ou reçues (les demandes signalées et en attente sont
 *   exclues), `total` leur somme. null sinon : le séquestre, la commission et le net ne comptent jamais d'achat.
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
 * @property {{ available: boolean, declaredAt: string|null }} completion
 *   Fin déclarée par l'étudiant (RD-DONE-01), lue pour les missions in_progress et done seulement.
 *   `available: false` quand la colonne n'existe pas encore en base ou pour les autres statuts ;
 *   `declaredAt` : date ISO (conservée une fois la mission terminée) ou null
 */

const NO_PURCHASES = Object.freeze({ available: false })

const isValidRequest = (r) =>
  r !== null &&
  typeof r === "object" &&
  typeof r.id === "string" &&
  PURCHASE_STATUSES.includes(r.status) &&
  Number.isSafeInteger(r.amount) &&
  r.amount > 0

// Demandes d'achats du client propriétaire : les lecteurs de RD-ACHATS-01 (ST-04) font l'accès, la propriété et la
// signature des photos ; ce module n'en garde que la forme exposée. Mission sans estimation d'achats ou sans étudiant
// retenu : aucune demande ne peut exister (le déclencheur de la base l'exige), donc aucune lecture. Table absente,
// réponse inattendue ou échec de lecture : indisponible (journalisé), jamais une erreur : l'écran reste lisible et la
// confirmation de fin accessible.
async function readPurchases(mission) {
  const estimate = purchasesEstimateOf(mission.purchases_estimate)
  if (estimate === null || !mission.selected_student_id) return NO_PURCHASES
  const res = await getClientPurchaseRequests({ missionId: mission.id })
  if (res?.error) {
    console.error("[getClientMissionDetail] demandes d'achats", res.code ?? "erreur")
    return NO_PURCHASES
  }
  if (res?.available !== true || !Array.isArray(res.requests)) return NO_PURCHASES
  // Ligne invalide (identifiant, statut ou montant inattendu) : ignorée, jamais affichée ni additionnée.
  const requests = res.requests.filter(isValidRequest)
  const totals = purchaseTotals(requests)
  const service = Number(mission.budget) || 0
  return {
    available: true,
    requests,
    totals,
    exceedsEstimate: exceedsEstimate({ requested: totals.requested, estimate }),
    confirmWarning: {
      show: mission.status === "in_progress" && totals.pending + totals.reported > 0,
      pending: requests.filter((r) => r.status === "pending").length,
      reported: requests.filter((r) => r.status === "reported").length,
    },
    costTotal:
      mission.status === "done" && totals.paid > 0
        ? { service, purchasesPaid: totals.paid, total: service + totals.paid }
        : null,
  }
}

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
  const [applicationsRes, ledgerRes, reviewRes, completionRes, purchases] = await Promise.all([
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
    mission.status === "in_progress" || mission.status === "done"
      ? readCompletionDeclared(supabase, [mission.id]).catch((failure) => ({ failure }))
      : Promise.resolve({ available: false, byId: new Map() }),
    readPurchases(mission),
  ])
  if (applicationsRes.error || ledgerRes.error || reviewRes.error) {
    console.error(
      "[getClientMissionDetail] lecture",
      applicationsRes.error?.message ?? ledgerRes.error?.message ?? reviewRes.error?.message,
    )
    throw new Error(ERR_LOAD)
  }

  if (completionRes.failure) {
    console.error("[getClientMissionDetail] fin déclarée", completionRes.failure?.code ?? completionRes.failure?.message)
    throw new Error(ERR_LOAD)
  }
  // Réponse sans la ligne (filtrée par la RLS, mission réattribuée) : indisponible, jamais un faux « non déclaré ».
  const known = completionRes.available && completionRes.byId.has(mission.id)
  const completion = { available: known, declaredAt: known ? (completionRes.byId.get(mission.id) ?? null) : null }

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
      purchasesEstimate: purchasesEstimateOf(mission.purchases_estimate),
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
    completion,
    purchases,
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
