"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireUser, requireRole } from "@/lib/auth/require-role"
import { toOwnedAvatarUrl, toOwnedStoragePath } from "@/lib/storage/owned-paths"
import { CITIES } from "@/lib/supabase/database.constants"
import { parseBeninPhone } from "@/lib/utils/phone"
import { firstName } from "@/lib/vitrine/public-name"

// Colonnes de la ligne de l'appelant, lues côté serveur : les colonnes privées (phone,
// rejection_reason, verification_submitted_at, card_url) ne sont plus lisibles avec la session.
const MY_PROFILE_COLUMNS =
  "user_id, full_name, city, avatar_url, bio, role, is_verified, verified_until, phone, rejection_reason, verification_submitted_at"
const MY_STUDENT_PROFILE_COLUMNS =
  "user_id, school, level, skills, availability, card_url"

// Résumé du profil client (C17) : colonnes explicites, `phone` lu en service role après requireRole.
const CLIENT_SUMMARY_COLUMNS = "user_id, full_name, city, avatar_url, bio, rating, created_at, phone"
const SUMMARY_REVIEWS_LIMIT = 10
const LEDGER_PAGE_SIZE = 1000 // plafond de lignes par requête de PostgREST
const LEDGER_MAX_PAGES = 50
const NAME_MAX = 100

const ERR_SUMMARY = "Impossible de charger votre profil."
const ERR_AVATAR = "Cette photo n'est pas valide. Envoyez-la à nouveau."
const ERR_CARD = "Cette carte n'est pas valide. Envoyez-la à nouveau."

/**
 * Lit la ligne `profiles` de l'utilisateur connecté, colonnes privées comprises.
 * Le filtre sur `user.id` vient de la session, jamais d'un paramètre.
 *
 * @returns {Promise<{ profile: object | null } | { error: string }>}
 */
export async function getMyProfile() {
  try {
    const auth = await requireUser()
    if (auth.error) return { error: auth.error }

    const { data, error } = await createServiceClient()
      .from("profiles")
      .select(MY_PROFILE_COLUMNS)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (error) {
      console.error("[getMyProfile]", error.message)
      return { error: "Impossible de charger votre profil." }
    }
    return { profile: data ?? null }
  } catch (err) {
    console.error("[getMyProfile]", err)
    return { error: "Impossible de charger votre profil." }
  }
}

// Contrôle de présence d'un caractère de contrôle (hors tabulation) dans un texte libre.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/

/**
 * Total dépensé : somme des libérations de séquestre (type `release`, montant brut commission comprise)
 * du grand livre de la session. La table legacy `transactions` n'est plus alimentée.
 * PostgREST plafonne chaque réponse à 1000 lignes : la lecture est paginée (stable : date puis id) pour que
 * la somme reste exacte au-delà. Une erreur de lecture, un montant illisible ou plus de 50 000 libérations
 * donnent `null` (affiché « Indisponible ») : jamais un faux 0 ni un total partiel.
 *
 * @returns {Promise<number | null>}
 */
async function readTotalSpent(supabase, userId) {
  let total = 0
  for (let page = 0; page < LEDGER_MAX_PAGES; page++) {
    const from = page * LEDGER_PAGE_SIZE
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "release")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + LEDGER_PAGE_SIZE - 1)
    if (error) {
      console.error("[getClientProfileSummary] total dépensé", error.message)
      return null
    }
    const rows = data ?? []
    // Valeur absolue : une libération peut être journalisée en négatif (comme receiptFromLedger).
    for (const row of rows) total += Math.abs(Number(row.amount ?? 0))
    if (!Number.isFinite(total)) return null
    if (rows.length < LEDGER_PAGE_SIZE) return total
  }
  return null
}

/** Compte exact (requête `head`), `null` en cas d'erreur de lecture. */
async function countRows(query, label) {
  const { count, error } = await query
  if (error) {
    console.error(`[getClientProfileSummary] ${label}`, error.message)
    return null
  }
  return count ?? 0
}

/**
 * @typedef {Object} ClientProfileSummary Forme consommée par les écrans C17 (consultation et édition).
 * @property {{ userId: string, fullName: string, companyName: string|null, city: string|null, avatarUrl: string|null,
 *   phone: string|null, memberSince: string|null }} identity `phone` est privé : il n'est lu que pour l'appelant
 * @property {{ published: number|null, active: number|null, done: number|null, cancelled: number|null,
 *   totalSpent: number|null, rating: number, reviewsCount: number|null }} stats
 *   `null` = lecture en échec (jamais un faux 0) ; `totalSpent` est la somme des `release` du grand livre
 * @property {Array<{ id: string, rating: number, comment: string|null, createdAt: string,
 *   authorFirstName: string, missionTitle: string|null }>} reviews Avis reçus (10 au plus), l'auteur réduit à son prénom
 */

/**
 * Résumé du profil du client connecté : identité, chiffres et avis reçus. `requireRole(["client"])` d'abord.
 * Colonnes explicites (jamais select("*")) ; le téléphone, colonne privée, est lu par le service role après le
 * contrôle du rôle, avec un filtre sur l'identifiant de la session. Les avis n'exposent que le prénom de l'auteur
 * (ni email ni téléphone). Les chiffres sont indépendants : une lecture en échec donne `null` pour ce chiffre seul.
 *
 * @returns {Promise<{ summary: ClientProfileSummary } | { error: string }>}
 */
export async function getClientProfileSummary() {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  try {
    const { data: profile, error: profileError } = await createServiceClient()
      .from("profiles")
      .select(CLIENT_SUMMARY_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle()
    if (profileError || !profile) {
      if (profileError) console.error("[getClientProfileSummary] profil", profileError.message)
      return { error: ERR_SUMMARY }
    }

    const missions = () => supabase.from("missions").select("id", { count: "exact", head: true }).eq("client_id", user.id)
    const [published, active, done, cancelled, totalSpent, reviewsCount, reviewsRes] = await Promise.all([
      countRows(missions(), "missions publiées"),
      countRows(missions().in("status", ["open", "in_progress"]), "missions actives"),
      countRows(missions().eq("status", "done"), "missions terminées"),
      countRows(missions().eq("status", "cancelled"), "missions annulées"),
      readTotalSpent(supabase, user.id),
      countRows(supabase.from("reviews").select("id", { count: "exact", head: true }).eq("reviewed_id", user.id), "avis"),
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_id, mission_id")
        .eq("reviewed_id", user.id)
        .order("created_at", { ascending: false })
        .limit(SUMMARY_REVIEWS_LIMIT),
    ])

    if (reviewsRes.error) console.error("[getClientProfileSummary] avis", reviewsRes.error.message)
    const rawReviews = reviewsRes.error ? [] : (reviewsRes.data ?? [])
    const authorIds = [...new Set(rawReviews.map((r) => r.reviewer_id).filter(Boolean))]
    const missionIds = [...new Set(rawReviews.map((r) => r.mission_id).filter(Boolean))]

    // Noms et titres sont décoratifs : une erreur donne le prénom par défaut ou pas de titre, sans faire échouer le profil.
    const [authorsRes, titlesRes] = await Promise.all([
      authorIds.length
        ? supabase.from("profiles").select("user_id, full_name").in("user_id", authorIds)
        : Promise.resolve({ data: [], error: null }),
      missionIds.length
        ? supabase.from("missions").select("id, title").eq("client_id", user.id).in("id", missionIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (authorsRes.error) console.error("[getClientProfileSummary] auteurs", authorsRes.error.message)
    if (titlesRes.error) console.error("[getClientProfileSummary] titres", titlesRes.error.message)
    const names = new Map((authorsRes.data ?? []).map((p) => [p.user_id, p.full_name]))
    const titles = new Map((titlesRes.data ?? []).map((m) => [m.id, m.title]))

    return {
      summary: {
        identity: {
          userId: user.id,
          fullName: typeof profile.full_name === "string" ? profile.full_name : "",
          companyName: profile.bio?.trim() ? profile.bio.trim() : null,
          city: profile.city ?? null,
          avatarUrl: profile.avatar_url ?? null,
          phone: profile.phone ?? null,
          memberSince: profile.created_at ?? null,
        },
        stats: {
          published,
          active,
          done,
          cancelled,
          totalSpent,
          rating: Number(profile.rating) || 0,
          reviewsCount,
        },
        reviews: rawReviews.map((r) => ({
          id: r.id,
          rating: Number(r.rating) || 0,
          comment: r.comment ?? null,
          createdAt: r.created_at,
          authorFirstName: firstName(names.get(r.reviewer_id), { fallback: "Étudiant" }),
          missionTitle: titles.get(r.mission_id) ?? null,
        })),
      },
    }
  } catch (err) {
    console.error("[getClientProfileSummary]", err)
    return { error: ERR_SUMMARY }
  }
}

/**
 * Lit la ligne `student_profiles` de l'utilisateur connecté, `card_url` comprise.
 *
 * @returns {Promise<{ studentProfile: object | null } | { error: string }>}
 */
export async function getMyStudentProfile() {
  try {
    const auth = await requireUser()
    if (auth.error) return { error: auth.error }

    const { data, error } = await createServiceClient()
      .from("student_profiles")
      .select(MY_STUDENT_PROFILE_COLUMNS)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (error) {
      console.error("[getMyStudentProfile]", error.message)
      return { error: "Impossible de charger votre profil." }
    }
    return { studentProfile: data ?? null }
  } catch (err) {
    console.error("[getMyStudentProfile]", err)
    return { error: "Impossible de charger votre profil." }
  }
}

/**
 * Met à jour le profil d'un étudiant connecté.
 * L'avatar est uploadé côté client - on reçoit ici uniquement son URL (string).
 *
 * @param {{ fullName, city, phone, bio, school, level, availability, skills: string[], avatarUrl?: string }} data
 */
export async function updateStudentProfile(data) {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: auth.error }
    const { supabase, user } = auth

    const { fullName, city, phone, bio, school, level, availability, skills, avatarUrl } = data

    if (!fullName?.trim()) return { error: "Le nom complet est requis." }
    if (!city?.trim())     return { error: "La ville est requise." }

    const avatar = avatarUrl ? toOwnedAvatarUrl(avatarUrl, user.id) : null
    if (avatarUrl && !avatar) return { error: ERR_AVATAR }

    const profileUpdate = {
      full_name: fullName.trim(),
      city: city.trim(),
      phone: phone?.trim() || null,
      bio: bio?.trim() || null,
    }
    if (avatarUrl) profileUpdate.avatar_url = avatar

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user.id)

    if (profileError) {
      console.error("[updateStudentProfile]", profileError.message)
      return { error: "Impossible d'enregistrer votre profil." }
    }

    const { error: studentError } = await supabase
      .from("student_profiles")
      .upsert(
        {
          user_id: user.id,
          school: school?.trim() || null,
          level: level?.trim() || null,
          availability: availability?.trim() || null,
          skills: Array.isArray(skills) ? skills : [],
        },
        { onConflict: "user_id" }
      )

    if (studentError) {
      console.error("[updateStudentProfile]", studentError.message)
      return { error: "Impossible d'enregistrer votre profil." }
    }

    revalidatePath("/profile")
    return { success: true }
  } catch (err) {
    console.error("[updateStudentProfile]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}

/**
 * Enregistre la carte étudiante (upload fait côté client). Seul le chemin dans le bucket privé
 * `student-cards` est stocké, et il doit se trouver dans le dossier de l'appelant.
 *
 * @param {string} cardUrl - chemin dans le bucket, ou URL Storage du projet (normalisée en chemin)
 */
export async function saveStudentCardUrl(cardUrl) {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: auth.error }
    const { supabase, user } = auth

    const cardPath = toOwnedStoragePath(cardUrl, "student-cards", user.id)
    if (!cardPath) return { error: ERR_CARD }

    const { error: updateError } = await supabase
      .from("student_profiles")
      .upsert({ user_id: user.id, card_url: cardPath }, { onConflict: "user_id" })

    if (updateError) {
      console.error("[saveStudentCardUrl]", updateError.message)
      return { error: "Impossible d'enregistrer votre carte étudiante." }
    }

    revalidatePath("/profile")
    return { success: true }
  } catch (err) {
    console.error("[saveStudentCardUrl]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}

/**
 * Met à jour le profil étudiant ET la carte si une nouvelle est fournie.
 * L'avatar et la carte sont uploadés côté client - on reçoit les URLs.
 *
 * @param {{
 *   fullName: string,
 *   city: string,
 *   phone?: string,
 *   bio?: string,
 *   school?: string,
 *   level?: string,
 *   availability?: string,
 *   skills?: string[],
 *   avatarUrl?: string,
 *   cardUrl?: string,
 * }} data
 */
export async function updateStudentProfileWithCard(data) {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: auth.error }
    const { supabase, user } = auth

    const { fullName, city, phone, bio, school, level, availability, skills, avatarUrl, cardUrl } = data

    if (!fullName?.trim()) return { error: "Le nom complet est requis." }
    if (!city?.trim())     return { error: "La ville est requise." }

    const avatar = avatarUrl ? toOwnedAvatarUrl(avatarUrl, user.id) : null
    if (avatarUrl && !avatar) return { error: ERR_AVATAR }

    const cardPath = cardUrl ? toOwnedStoragePath(cardUrl, "student-cards", user.id) : null
    if (cardUrl && !cardPath) return { error: ERR_CARD }

    // Mise à jour du profil principal
    const profileUpdate = {
      full_name: fullName.trim(),
      city:      city.trim(),
      phone:     phone?.trim() || null,
      bio:       bio?.trim()   || null,
    }
    if (avatarUrl) profileUpdate.avatar_url = avatar

    // Si une nouvelle carte est soumise : repasse en attente de vérification
    if (cardPath) {
      profileUpdate.is_verified               = false
      profileUpdate.rejection_reason          = null
      profileUpdate.verification_submitted_at = new Date().toISOString()
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user.id)

    if (profileError) {
      console.error("[updateStudentProfileWithCard]", profileError.message)
      return { error: "Impossible d'enregistrer votre profil." }
    }

    // Mise à jour du profil académique
    const studentUpdate = {
      user_id:      user.id,
      school:       school?.trim()      || null,
      level:        level?.trim()       || null,
      availability: availability?.trim() || null,
      skills:       Array.isArray(skills) ? skills : [],
    }
    if (cardPath) studentUpdate.card_url = cardPath

    const { error: studentError } = await supabase
      .from("student_profiles")
      .upsert(studentUpdate, { onConflict: "user_id" })

    if (studentError) {
      console.error("[updateStudentProfileWithCard]", studentError.message)
      return { error: "Impossible d'enregistrer votre profil." }
    }

    revalidatePath("/profile")
    revalidatePath("/student/profile")
    return { success: true }
  } catch (err) {
    console.error("[updateStudentProfileWithCard]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}

/**
 * Met à jour le profil d'un client connecté.
 * L'avatar est uploadé côté client - on reçoit ici uniquement son URL (string).
 *
 * @param {{ fullName, city, phone, companyName, avatarUrl?: string }} data
 */
export async function updateClientProfile(data) {
  try {
    const auth = await requireRole(["client"])
    if (auth.error) return { error: auth.error }
    const { supabase, user } = auth

    const { fullName, city, phone, companyName, avatarUrl } = data

    if (!fullName?.trim()) return { error: "Le nom complet est requis." }
    if (!city?.trim())     return { error: "La ville est requise." }
    if (!CITIES.includes(city.trim())) return { error: "Choisissez une ville de la liste." }
    for (const text of [fullName, companyName]) {
      if (typeof text === "string" && (text.trim().length > NAME_MAX || CONTROL_CHARS.test(text))) {
        return { error: `Les noms ne doivent pas dépasser ${NAME_MAX} caractères ni contenir de caractère spécial.` }
      }
    }

    // Téléphone facultatif ; s'il est renseigné, numéro béninois enregistré au format +22901XXXXXXXX.
    let phoneValue = null
    if (typeof phone === "string" && phone.trim()) {
      const parsed = parseBeninPhone(phone)
      if (!parsed.ok) return { error: "Le numéro doit avoir 10 chiffres et commencer par 01. Ex. 01 97 45 21 08" }
      phoneValue = parsed.e164
    }

    const avatar = avatarUrl ? toOwnedAvatarUrl(avatarUrl, user.id) : null
    if (avatarUrl && !avatar) return { error: "Ce logo n'est pas valide. Envoyez-le à nouveau." }

    const profileUpdate = {
      full_name: fullName.trim(),
      city: city.trim(),
      phone: phoneValue,
      bio: companyName?.trim() || null,
    }
    if (avatarUrl) profileUpdate.avatar_url = avatar

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user.id)

    if (profileError) {
      console.error("[updateClientProfile]", profileError.message)
      return { error: "Impossible d'enregistrer votre profil." }
    }

    revalidatePath("/client/profile")
    return { success: true }
  } catch (err) {
    console.error("[updateClientProfile]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}
