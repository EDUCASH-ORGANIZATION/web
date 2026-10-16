"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/require-role"
import { ANONYMOUS_CLIENT_NAME } from "@/lib/constants/client-name"
import { isUuid } from "@/lib/vitrine/ids"
import { publicDisplayName } from "@/lib/vitrine/public-name"
import { toProjectAvatarUrl } from "@/lib/storage/owned-paths"
import { notify } from "@/lib/notifications/notify"
import { reviewReceived } from "@/lib/notifications/catalog"

// Avis du client sur l'étudiant retenu d'une de ses missions terminées (C10).
// La personne notée est toujours déduite de la mission (selected_student_id), jamais d'un paramètre.
// La base porte `unique (mission_id, reviewer_id)` et `rating between 1 and 5` : le contrôle fait ici
// donne un message clair, la contrainte reste le dernier rempart (double envoi simultané).

const REVIEW_COMMENT_MAX = 300

const ERR_NOT_FOUND = "Cette mission est introuvable."
const ERR_RATING = "Choisissez une note de 1 à 5 étoiles."
const ERR_COMMENT_TYPE = "Votre commentaire n'est pas valide."
const ERR_COMMENT_LENGTH = `Votre commentaire ne doit pas dépasser ${REVIEW_COMMENT_MAX} caractères.`
const ERR_COMMENT_CHARS = "Votre commentaire contient des caractères non autorisés."
const ERR_NOT_DONE = "Vous pourrez noter l'étudiant une fois la mission terminée."
const ERR_NO_STUDENT = "Aucun étudiant n'est associé à cette mission."
const ERR_ALREADY = "Vous avez déjà noté l'étudiant pour cette mission."
const ERR_SAVE = "Impossible d'enregistrer votre avis. Réessayez dans un instant."
const ERR_LOAD = "Impossible de charger cette page."
const ERR_STUDENT_NOT_DONE = "Vous pourrez noter le client une fois la mission terminée."
const ERR_STUDENT_ALREADY = "Vous avez déjà noté le client pour cette mission."

// Codes de contrôle (sauf tabulation et sauts de ligne) et marques de direction du texte.
const FORBIDDEN_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/
const UNIQUE_VIOLATION = "23505"

/**
 * Notification in-app « Nouvel avis » au profil noté. Ne lève jamais : l'avis est déjà enregistré, un échec
 * d'écriture ou de construction du texte ne doit pas le transformer en erreur.
 * @param {{ recipientId: string, missionId: string, missionTitle: string|null, reviewerId: string, reviewerName: string|null }} params
 */
async function notifyReview({ recipientId, missionId, missionTitle, reviewerId, reviewerName }) {
  try {
    await notify({
      recipientId,
      ...reviewReceived({ missionId, missionTitle, reviewerId, reviewerName }),
    })
  } catch (err) {
    console.error("[review.actions] notification ignorée:", err?.code ?? "erreur")
  }
}

/**
 * Valide le commentaire : texte facultatif, borné, sans caractère de contrôle.
 * @param {unknown} value
 * @returns {{ ok: true, value: string | null } | { ok: false, error: string }}
 */
function checkComment(value) {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== "string") return { ok: false, error: ERR_COMMENT_TYPE }
  if (FORBIDDEN_CHARS.test(value)) return { ok: false, error: ERR_COMMENT_CHARS }
  const text = value.trim()
  if (text.length > REVIEW_COMMENT_MAX) return { ok: false, error: ERR_COMMENT_LENGTH }
  return { ok: true, value: text === "" ? null : text }
}

/**
 * Note entière de 1 à 5 : un nombre, jamais une chaîne, un décimal, NaN ni une valeur hors bornes.
 * @param {unknown} value
 */
function isValidRating(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
}

/**
 * Enregistre l'avis du client connecté sur l'étudiant retenu d'une de ses missions terminées.
 * `requireRole(["client"])` d'abord. Refus neutres : mission d'un autre client, inexistante ou mal
 * formée donnent le même message ; mission non terminée, sans étudiant retenu ou déjà notée sont refusées.
 *
 * @param {{ missionId: string, rating: number, comment?: string | null }} input
 * @returns {Promise<{ success: true, review: { rating: number, comment: string | null } } | { error: string }>}
 */
export async function createClientReview(input) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  try {
    const { missionId, rating, comment } = input && typeof input === "object" ? input : {}

    if (!isUuid(missionId)) return { error: ERR_NOT_FOUND }
    if (!isValidRating(rating)) return { error: ERR_RATING }
    const checked = checkComment(comment)
    if (!checked.ok) return { error: checked.error }

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, title, status, selected_student_id")
      .eq("id", missionId)
      .eq("client_id", user.id)
      .maybeSingle()
    if (missionError) {
      console.error("[createClientReview] mission", missionError.message)
      return { error: ERR_SAVE }
    }
    if (!mission) return { error: ERR_NOT_FOUND }
    if (mission.status !== "done") return { error: ERR_NOT_DONE }
    if (!mission.selected_student_id) return { error: ERR_NO_STUDENT }

    const { data: existing, error: existingError } = await supabase
      .from("reviews")
      .select("id")
      .eq("mission_id", mission.id)
      .eq("reviewer_id", user.id)
      .maybeSingle()
    if (existingError) {
      console.error("[createClientReview] avis existant", existingError.message)
      return { error: ERR_SAVE }
    }
    if (existing) return { error: ERR_ALREADY }

    const { error: insertError } = await supabase.from("reviews").insert({
      mission_id: mission.id,
      reviewer_id: user.id,
      reviewed_id: mission.selected_student_id,
      rating,
      comment: checked.value,
    })
    if (insertError) {
      // Double envoi simultané : la contrainte unique de la base tranche.
      if (insertError.code === UNIQUE_VIOLATION) return { error: ERR_ALREADY }
      console.error("[createClientReview] insert", insertError.message)
      return { error: ERR_SAVE }
    }

    await notifyReview({
      recipientId: mission.selected_student_id,
      missionId: mission.id,
      missionTitle: mission.title,
      reviewerId: user.id,
      reviewerName: auth.profile?.full_name,
    })

    // La note moyenne du profil noté est recalculée en base (trigger recompute_profile_rating).
    revalidatePath(`/talents/${mission.selected_student_id}`)
    revalidatePath(`/client/missions/${mission.id}`)
    revalidatePath("/client/missions")
    revalidatePath("/client/dashboard")
    return { success: true, review: { rating, comment: checked.value } }
  } catch (err) {
    console.error("[createClientReview]", err)
    return { error: ERR_SAVE }
  }
}

/**
 * @typedef {Object} ClientReviewPage Données de la page C10.
 * @property {"form"|"already"|"not_done"} state
 * @property {{ id: string, title: string, budget: number, status: string }} mission
 * @property {{ id: string, fullName: string, avatarUrl: string|null }|null} student Étudiant retenu, sinon null
 * @property {{ rating: number, comment: string|null, createdAt: string }|null} review Avis déjà donné
 * @property {string} authorName Nom du client tel qu'enregistré (la vue le réduit à « Prénom I. »)
 */

/**
 * Données de la page « Noter l'étudiant ». `requireRole(["client"])` d'abord. Une mission inexistante,
 * mal formée ou d'un autre client donne `null` (la page répond 404). Une lecture en échec lève une erreur
 * neutre (error.js), jamais un message SQL. Colonnes publiques de `profiles` seulement.
 *
 * @param {string} missionId
 * @returns {Promise<ClientReviewPage | null>}
 */
export async function getClientReviewPage(missionId) {
  const auth = await requireRole(["client"])
  if (auth.error) return null
  if (!isUuid(missionId)) return null
  const { supabase, user } = auth

  const { data: mission, error } = await supabase
    .from("missions")
    .select("id, title, budget, status, selected_student_id")
    .eq("id", missionId)
    .eq("client_id", user.id)
    .maybeSingle()
  if (error) {
    console.error("[getClientReviewPage] mission", error.message)
    throw new Error(ERR_LOAD)
  }
  if (!mission) return null

  const studentId = mission.selected_student_id ?? null
  const [studentRes, reviewRes, authorRes] = await Promise.all([
    studentId
      ? supabase.from("profiles").select("user_id, full_name, avatar_url").eq("user_id", studentId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("reviews")
      .select("rating, comment, created_at")
      .eq("mission_id", mission.id)
      .eq("reviewer_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
  ])
  if (studentRes.error || reviewRes.error) {
    console.error("[getClientReviewPage] lecture", studentRes.error?.message ?? reviewRes.error?.message)
    throw new Error(ERR_LOAD)
  }

  const review = reviewRes.data
    ? {
        rating: Number(reviewRes.data.rating) || 0,
        comment: reviewRes.data.comment ?? null,
        createdAt: reviewRes.data.created_at,
      }
    : null
  const student = studentId
    ? {
        id: studentId,
        fullName: typeof studentRes.data?.full_name === "string" ? studentRes.data.full_name : "",
        avatarUrl: studentRes.data?.avatar_url ?? null,
      }
    : null

  let state = "form"
  if (review) state = "already"
  else if (mission.status !== "done" || !student) state = "not_done"

  return {
    state,
    mission: { id: mission.id, title: mission.title, budget: Number(mission.budget) || 0, status: mission.status },
    student,
    review,
    // Un échec de lecture du nom (décoratif) donne la signature par défaut, sans faire échouer la page.
    authorName: typeof authorRes.data?.full_name === "string" ? authorRes.data.full_name : "",
  }
}

/**
 * Enregistre l'avis de l'étudiant retenu sur le client d'une mission terminée (E13).
 * `requireRole(["student"])` d'abord. La personne notée est `mission.client_id`, lue en base : jamais un
 * paramètre ni le formulaire. Refus neutres : mission inexistante, mal formée ou dont l'appelant n'est pas
 * l'étudiant retenu donnent le même message ; mission non terminée ou déjà notée sont refusées. Le double envoi
 * simultané est tranché par la contrainte unique (mission, auteur).
 *
 * @param {{ missionId: string, rating: number, comment?: string | null }} input
 * @returns {Promise<{ success: true, review: { rating: number, comment: string | null } } | { error: string }>}
 */
export async function createStudentReview(input) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  try {
    const { missionId, rating, comment } = input && typeof input === "object" ? input : {}

    if (!isUuid(missionId)) return { error: ERR_NOT_FOUND }
    if (!isValidRating(rating)) return { error: ERR_RATING }
    const checked = checkComment(comment)
    if (!checked.ok) return { error: checked.error }

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, title, status, client_id")
      .eq("id", missionId)
      .eq("selected_student_id", user.id)
      .maybeSingle()
    if (missionError) {
      console.error("[createStudentReview] mission", missionError.message)
      return { error: ERR_SAVE }
    }
    if (!mission || !mission.client_id) return { error: ERR_NOT_FOUND }
    if (mission.status !== "done") return { error: ERR_STUDENT_NOT_DONE }

    const { data: existing, error: existingError } = await supabase
      .from("reviews")
      .select("id")
      .eq("mission_id", mission.id)
      .eq("reviewer_id", user.id)
      .maybeSingle()
    if (existingError) {
      console.error("[createStudentReview] avis existant", existingError.message)
      return { error: ERR_SAVE }
    }
    if (existing) return { error: ERR_STUDENT_ALREADY }

    const { error: insertError } = await supabase.from("reviews").insert({
      mission_id: mission.id,
      reviewer_id: user.id,
      reviewed_id: mission.client_id,
      rating,
      comment: checked.value,
    })
    if (insertError) {
      // Double envoi simultané : la contrainte unique de la base tranche.
      if (insertError.code === UNIQUE_VIOLATION) return { error: ERR_STUDENT_ALREADY }
      console.error("[createStudentReview] insert", insertError.message)
      return { error: ERR_SAVE }
    }

    await notifyReview({
      recipientId: mission.client_id,
      missionId: mission.id,
      missionTitle: mission.title,
      reviewerId: user.id,
      reviewerName: auth.profile?.full_name,
    })

    // La note moyenne du profil noté est recalculée en base (trigger recompute_profile_rating).
    revalidatePath(`/student/missions/${mission.id}`)
    revalidatePath("/applications")
    revalidatePath("/dashboard")
    return { success: true, review: { rating, comment: checked.value } }
  } catch (err) {
    console.error("[createStudentReview]", err)
    return { error: ERR_SAVE }
  }
}

/**
 * @typedef {Object} StudentReviewPage Données de la page E13.
 * @property {"form"|"already"|"not_done"} state
 * @property {{ id: string, title: string, type: string, budget: number, status: string }} mission
 * @property {{ name: string, avatarUrl: string|null, city: string|null }} client Profil public : « Prénom I. »
 * @property {{ rating: number, comment: string|null, createdAt: string }|null} review Avis déjà donné
 */

/**
 * Données de la page « Noter le client ». `requireRole(["student"])` d'abord. Une mission inexistante, mal
 * formée ou dont l'appelant n'est pas l'étudiant retenu donne `null` (la page répond 404). Une lecture en
 * échec lève une erreur neutre (error.js), jamais un message SQL. Colonnes publiques de `profiles` seulement.
 *
 * @param {string} missionId
 * @returns {Promise<StudentReviewPage | null>}
 */
export async function getStudentReviewPage(missionId) {
  const auth = await requireRole(["student"])
  if (auth.error) return null
  if (!isUuid(missionId)) return null
  const { supabase, user } = auth

  const { data: mission, error } = await supabase
    .from("missions")
    .select("id, title, type, budget, status, client_id")
    .eq("id", missionId)
    .eq("selected_student_id", user.id)
    .maybeSingle()
  if (error) {
    console.error("[getStudentReviewPage] mission", error.message)
    throw new Error(ERR_LOAD)
  }
  if (!mission) return null

  const [clientRes, reviewRes] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url, city").eq("user_id", mission.client_id).maybeSingle(),
    supabase
      .from("reviews")
      .select("rating, comment, created_at")
      .eq("mission_id", mission.id)
      .eq("reviewer_id", user.id)
      .maybeSingle(),
  ])
  if (clientRes.error || reviewRes.error) {
    console.error("[getStudentReviewPage] lecture", clientRes.error?.message ?? reviewRes.error?.message)
    throw new Error(ERR_LOAD)
  }

  const review = reviewRes.data
    ? {
        rating: Number(reviewRes.data.rating) || 0,
        comment: reviewRes.data.comment ?? null,
        createdAt: reviewRes.data.created_at,
      }
    : null
  const fullName = typeof clientRes.data?.full_name === "string" ? clientRes.data.full_name : ""

  let state = "form"
  if (review) state = "already"
  else if (mission.status !== "done") state = "not_done"

  return {
    state,
    mission: {
      id: mission.id,
      title: mission.title,
      type: mission.type,
      budget: Number(mission.budget) || 0,
      status: mission.status,
    },
    client: {
      name: fullName ? publicDisplayName(fullName) : ANONYMOUS_CLIENT_NAME,
      avatarUrl: toProjectAvatarUrl(clientRes.data?.avatar_url),
      city: clientRes.data?.city ?? null,
    },
    review,
  }
}
