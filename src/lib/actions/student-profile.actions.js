"use server"

// Profil de l'étudiant connecté (E10 consultation, E11 modification).
// Les colonnes privées (téléphone, carte, motif de refus, date de dépôt) sont lues par `getMyProfile` et
// `getMyStudentProfile` (service role, filtre sur la session) puis réduites avant de sortir de l'action :
// la consultation ne reçoit qu'un statut de vérification calculé ; seul le formulaire de l'utilisateur
// reçoit son propre téléphone. L'écriture passe par `updateStudentProfile`, après un contrôle des champs.

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { getMyProfile, getMyStudentProfile, updateStudentProfile } from "@/lib/actions/profile.actions"
import { getUniversities } from "@/lib/actions/university.actions"
import { verificationFromRows } from "@/lib/student-space/verification-status"
import { validateStudentProfile, SKILLS_MAX } from "@/lib/student-space/profile-rules"
import { parseBeninPhone } from "@/lib/utils/phone"
import { firstName } from "@/lib/vitrine/public-name"

const ERR_SUMMARY = "Impossible de charger votre profil."
const ERR_SAVE = "Impossible d'enregistrer votre profil."
const ERR_INVALID = "Certains champs sont à corriger avant d'enregistrer."

const REVIEWS_LIMIT = 10
const LEDGER_PAGE_SIZE = 1000 // plafond de lignes par requête de PostgREST
const LEDGER_MAX_PAGES = 50

/**
 * Total gagné : somme des libérations de séquestre (type `release`) du grand livre de l'étudiant, qui portent
 * son NET (commission déjà déduite). La table legacy `transactions` n'est plus alimentée. PostgREST plafonne
 * chaque réponse à 1000 lignes : la lecture est paginée (date puis id, stable) pour que la somme reste exacte
 * au-delà. Une erreur de lecture, un montant illisible ou plus de 50 000 libérations donnent `null`
 * (affiché « Indisponible ») : jamais un faux 0 ni un total partiel.
 * @returns {Promise<number | null>}
 */
async function readTotalEarned(supabase, userId) {
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
      console.error("[getStudentProfileSummary] total gagné", error.message)
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
    console.error(`[getStudentProfileSummary] ${label}`, error.message)
    return null
  }
  return count ?? 0
}

function skillsOf(studentProfile) {
  return Array.isArray(studentProfile?.skills) ? studentProfile.skills.filter((s) => typeof s === "string") : []
}

/**
 * @typedef {Object} StudentProfileSummary Forme consommée par la consultation (E10).
 * @property {{ userId: string, fullName: string, city: string|null, avatarUrl: string|null, bio: string|null,
 *   school: string|null, level: string|null, skills: string[], availability: string|null,
 *   memberSince: string|null }} identity Aucune colonne privée (ni téléphone, ni carte)
 * @property {{ key: string, label: string, canApply: boolean, daysLeft: number|null,
 *   action: { label: string, href: string }|null, verifiedUntil: string|null }} verification Statut calculé ;
 *   `verifiedUntil` n'est renseignée que pour un badge actif
 * @property {{ done: number|null, totalEarned: number|null, rating: number, reviewsCount: number|null }} stats
 *   `null` = lecture en échec (jamais un faux 0) ; `totalEarned` est la somme des `release` du grand livre
 * @property {Array<{ id: string, rating: number, comment: string|null, createdAt: string, authorFirstName: string,
 *   missionTitle: string|null }>} reviews Avis reçus (10 au plus), l'auteur réduit à son prénom
 */

/**
 * Résumé du profil de l'étudiant connecté. `requireRole(["student"])` d'abord. Colonnes explicites (jamais
 * select("*")). Les chiffres sont indépendants : une lecture en échec donne `null` pour ce chiffre seul.
 * @returns {Promise<{ summary: StudentProfileSummary } | { error: string }>}
 */
export async function getStudentProfileSummary() {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: ERR_SUMMARY }
  const { supabase, user } = auth

  try {
    const [privateRes, studentRes, publicRes, done, totalEarned, reviewsCount, reviewsRes] = await Promise.all([
      getMyProfile(),
      getMyStudentProfile(),
      createServiceClient().from("profiles").select("rating, created_at").eq("user_id", user.id).maybeSingle(),
      countRows(
        supabase
          .from("missions")
          .select("id", { count: "exact", head: true })
          .eq("selected_student_id", user.id)
          .eq("status", "done"),
        "missions terminées",
      ),
      readTotalEarned(supabase, user.id),
      countRows(supabase.from("reviews").select("id", { count: "exact", head: true }).eq("reviewed_id", user.id), "avis"),
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_id, mission_id")
        .eq("reviewed_id", user.id)
        .order("created_at", { ascending: false })
        .limit(REVIEWS_LIMIT),
    ])

    // Sans lecture fiable du profil, aucun écran : un statut de vérification faux serait pire qu'une erreur.
    if (privateRes.error || studentRes.error || !privateRes.profile) return { error: ERR_SUMMARY }
    if (publicRes.error) console.error("[getStudentProfileSummary] profil", publicRes.error.message)

    if (reviewsRes.error) console.error("[getStudentProfileSummary] avis", reviewsRes.error.message)
    const rawReviews = reviewsRes.error ? [] : (reviewsRes.data ?? [])
    const authorIds = [...new Set(rawReviews.map((r) => r.reviewer_id).filter(Boolean))]
    const missionIds = [...new Set(rawReviews.map((r) => r.mission_id).filter(Boolean))]

    // Noms et titres sont décoratifs : une erreur donne le prénom par défaut ou pas de titre, sans faire échouer le profil.
    const [authorsRes, titlesRes] = await Promise.all([
      authorIds.length
        ? supabase.from("profiles").select("user_id, full_name").in("user_id", authorIds)
        : Promise.resolve({ data: [], error: null }),
      missionIds.length
        ? supabase.from("missions").select("id, title").eq("selected_student_id", user.id).in("id", missionIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (authorsRes.error) console.error("[getStudentProfileSummary] auteurs", authorsRes.error.message)
    if (titlesRes.error) console.error("[getStudentProfileSummary] titres", titlesRes.error.message)
    const names = new Map((authorsRes.data ?? []).map((p) => [p.user_id, p.full_name]))
    const titles = new Map((titlesRes.data ?? []).map((m) => [m.id, m.title]))

    const profile = privateRes.profile
    const studentProfile = studentRes.studentProfile
    const verification = verificationFromRows(profile, studentProfile)
    const publicRow = publicRes.error ? null : publicRes.data

    return {
      summary: {
        identity: {
          userId: user.id,
          fullName: typeof profile.full_name === "string" ? profile.full_name : "",
          city: profile.city ?? null,
          avatarUrl: profile.avatar_url ?? null,
          bio: profile.bio?.trim() ? profile.bio.trim() : null,
          school: studentProfile?.school?.trim() ? studentProfile.school.trim() : null,
          level: studentProfile?.level?.trim() ? studentProfile.level.trim() : null,
          skills: skillsOf(studentProfile),
          availability: studentProfile?.availability?.trim() ? studentProfile.availability.trim() : null,
          memberSince: publicRow?.created_at ?? null,
        },
        // Seul le statut calculé sort ; la date de fin du badge n'est transmise que s'il est actif.
        verification: {
          key: verification.key,
          label: verification.label,
          canApply: verification.canApply,
          daysLeft: verification.daysLeft,
          action: verification.action,
          verifiedUntil:
            (verification.key === "verified" || verification.key === "expiring") && profile.verified_until
              ? profile.verified_until
              : null,
        },
        stats: {
          done,
          totalEarned,
          rating: Number(publicRow?.rating) || 0,
          reviewsCount,
        },
        reviews: rawReviews.map((r) => ({
          id: r.id,
          rating: Number(r.rating) || 0,
          comment: r.comment ?? null,
          createdAt: r.created_at,
          authorFirstName: firstName(names.get(r.reviewer_id), { fallback: "Client" }),
          missionTitle: titles.get(r.mission_id) ?? null,
        })),
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentProfileSummary]", err)
    return { error: ERR_SUMMARY }
  }
}

/**
 * @typedef {Object} StudentProfileForm Valeurs actuelles du formulaire (E11).
 * @property {{ userId: string, fullName: string, city: string, phone: string, bio: string, school: string,
 *   level: string, availability: string, skills: string[], avatarUrl: string|null }} values `phone` est le
 *   téléphone DE L'UTILISATEUR, lu côté serveur (colonne privée) pour ne pas être effacé à l'enregistrement
 * @property {{ key: string, label: string, action: { label: string, href: string }|null }} verification
 * @property {Array<{ name: string, shortName: string|null }>} universities
 */

/**
 * Valeurs de départ du formulaire de modification. `requireRole(["student"])` d'abord. Sans lecture fiable du
 * profil, aucune valeur n'est renvoyée : le formulaire enverrait un téléphone vide et l'effacerait.
 * @returns {Promise<{ form: StudentProfileForm } | { error: string }>}
 */
export async function getStudentProfileForm() {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: ERR_SUMMARY }
  const { user } = auth

  try {
    const [privateRes, studentRes, universities] = await Promise.all([
      getMyProfile(),
      getMyStudentProfile(),
      getUniversities(),
    ])
    if (privateRes.error || studentRes.error || !privateRes.profile) return { error: ERR_SUMMARY }

    const profile = privateRes.profile
    const studentProfile = studentRes.studentProfile
    const verification = verificationFromRows(profile, studentProfile)

    return {
      form: {
        values: {
          userId: user.id,
          fullName: typeof profile.full_name === "string" ? profile.full_name : "",
          city: profile.city ?? "",
          phone: profile.phone ?? "",
          bio: profile.bio ?? "",
          school: studentProfile?.school ?? "",
          level: studentProfile?.level ?? "",
          availability: studentProfile?.availability ?? "",
          skills: skillsOf(studentProfile),
          avatarUrl: profile.avatar_url ?? null,
        },
        verification: { key: verification.key, label: verification.label, action: verification.action },
        universities: (universities ?? []).map((u) => ({ name: u.name, shortName: u.short_name ?? null })),
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentProfileForm]", err)
    return { error: ERR_SUMMARY }
  }
}

/**
 * Enregistre le profil de l'étudiant connecté. `requireRole(["student"])` d'abord, puis contrôle des champs
 * (le serveur est l'autorité : ville de la liste, téléphone béninois, bornes de longueur, compétences), puis
 * écriture par liste blanche (`updateStudentProfile` : jamais role, is_verified, is_suspended, verified_until).
 * La photo n'est acceptée que si son URL désigne un fichier du dossier `avatars/<userId>/` (validé par
 * `updateStudentProfile`).
 * @param {{ fullName: string, city: string, phone: string, bio?: string, school?: string, level?: string,
 *   availability?: string, skills?: string[], avatarUrl?: string }} data
 * @returns {Promise<{ success: true } | { error: string, errors?: Record<string, string> }>}
 */
export async function saveStudentProfile(data) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }

  try {
    const input = data && typeof data === "object" ? data : {}
    const errors = validateStudentProfile(input)
    if (Object.keys(errors).length > 0) return { error: ERR_INVALID, errors }

    // Compétences distinctes, bornées : la validation a déjà refusé plus de SKILLS_MAX entrées.
    const skills = [...new Set((input.skills ?? []).map((s) => s.trim()))].slice(0, SKILLS_MAX)
    const result = await updateStudentProfile({
      fullName: input.fullName,
      city: input.city,
      phone: parseBeninPhone(input.phone).e164,
      bio: input.bio ?? "",
      school: input.school ?? "",
      level: input.level ?? "",
      availability: input.availability ?? "",
      skills,
      avatarUrl: typeof input.avatarUrl === "string" && input.avatarUrl ? input.avatarUrl : undefined,
    })
    if (result?.error) return { error: result.error }
    return { success: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[saveStudentProfile]", err)
    return { error: ERR_SAVE }
  }
}
