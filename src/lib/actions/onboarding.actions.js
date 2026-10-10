"use server"

// Onboardings étudiant et client. Le navigateur n'écrit plus jamais dans `profiles` :
// il envoie des fichiers vers Storage puis appelle ces actions, qui
//  - lisent le rôle sur `profiles.role` côté serveur (jamais celui du client),
//  - n'écrivent qu'une liste blanche de colonnes (aucun role, is_verified, is_suspended,
//    verified_until, rejection_reason, rating, user_id fourni par l'appelant),
//  - fonctionnent avant comme après le correctif SQL (aucune colonne protégée n'est modifiée).
import { createClient } from "@/lib/supabase/server"
import { getServerRole } from "@/lib/auth/server-role"
import { resolvePostAuth } from "@/lib/auth/destinations"
import {
  makeStudentIdentitySchema,
  makeStudentStudiesSchema,
  makeClientTypeSchema,
  makeClientIdentitySchema,
} from "@/lib/auth/schemas"

const STORAGE_MODES = ["public", "sign", "authenticated"]

const MESSAGES = {
  student: {
    unauthenticated: "Ta session a expiré. Connecte-toi pour continuer.",
    wrong_role: "Cette page est réservée aux étudiants. Reconnecte-toi avec ton compte étudiant.",
    suspended: "Ton compte est suspendu. Contacte-nous pour en savoir plus.",
    already_done: "Ton profil est déjà complété.",
    invalid: "Certaines informations ne sont pas valides. Vérifie les champs signalés.",
    save_failed: "Nous n'avons pas pu enregistrer ton profil. Réessaie dans un instant.",
  },
  client: {
    unauthenticated: "Votre session a expiré. Connectez-vous pour continuer.",
    wrong_role: "Cette page est réservée aux clients. Reconnectez-vous avec votre compte client.",
    suspended: "Votre compte est suspendu. Contactez-nous pour en savoir plus.",
    already_done: "Votre profil est déjà complété.",
    invalid: "Certaines informations ne sont pas valides. Vérifiez les champs signalés.",
    save_failed: "Nous n'avons pas pu enregistrer votre profil. Réessayez dans un instant.",
  },
}

function failure(audience, code, extra = {}) {
  return { ok: false, code, message: MESSAGES[audience][code], ...extra }
}

/**
 * État d'un écran d'onboarding, lu côté serveur.
 * @param {"student" | "client"} expectedRole
 * @returns {Promise<{
 *   status: "unauthenticated" | "wrong_role" | "suspended" | "ok",
 *   user: object | null,
 *   role: "student" | "client" | "admin" | null,
 *   profile: object | null,
 *   profileComplete: boolean,
 * }>} `wrong_role` : l'utilisateur est connecté avec un autre rôle (ou un rôle inconnu) ;
 *   `role` permet d'orienter vers son espace via `dashboardFor`.
 */
export async function getOnboardingState(expectedRole) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { status: "unauthenticated", user: null, role: null, profile: null, profileComplete: false }
  }

  const { role, profile, profileComplete } = await getServerRole(supabase, user)
  const base = { user, role, profile, profileComplete }
  if (role !== expectedRole) return { status: "wrong_role", ...base }
  if (profile?.is_suspended) return { status: "suspended", ...base }
  return { status: "ok", ...base }
}

// Une URL d'objet Storage n'est acceptée que si elle vient du projet et du dossier de l'utilisateur.
function storageUrl(value, bucket, userId) {
  if (value === undefined || value === null || value === "") return { ok: true, url: null }
  if (typeof value !== "string") return { ok: false }
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    const url = new URL(value)
    if (url.origin !== base.origin) return { ok: false }
    const allowed = STORAGE_MODES.some((mode) =>
      url.pathname.startsWith(`/storage/v1/object/${mode}/${bucket}/${userId}/`)
    )
    return allowed ? { ok: true, url: url.toString() } : { ok: false }
  } catch {
    return { ok: false }
  }
}

function collectErrors(results) {
  const fieldErrors = {}
  const data = {}
  for (const result of results) {
    if (result.success) {
      Object.assign(data, result.data)
      continue
    }
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form")
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message
    }
  }
  return { fieldErrors, data }
}

function asObject(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}
}

// Contexte commun : utilisateur, rôle serveur attendu, profil existant.
async function loadContext(expectedRole, next) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: failure(expectedRole, "unauthenticated") }

  const { role, profile, profileComplete, error: roleError } = await getServerRole(supabase, user)
  // Lecture du profil impossible : refus neutre, jamais d'écriture sans rôle vérifié.
  if (roleError) return { error: failure(expectedRole, "save_failed") }
  if (role !== expectedRole) return { error: failure(expectedRole, "wrong_role") }
  if (profile?.is_suspended) return { error: failure(expectedRole, "suspended") }
  // L'onboarding ne se rejoue pas : un profil complet ne peut plus être réécrit par cette action.
  if (profileComplete) {
    return {
      error: failure(expectedRole, "already_done", {
        destination: resolvePostAuth({ role: expectedRole, profileComplete: true, next }),
      }),
    }
  }
  return { supabase, user, profile }
}

// Écrit la liste blanche : update si le profil existe, sinon insertion avec le rôle serveur.
async function writeProfile({ supabase, user, profile, role, columns }) {
  if (profile) {
    const { data, error } = await supabase
      .from("profiles")
      .update(columns)
      .eq("user_id", user.id)
      .select("user_id")
    return !error && Array.isArray(data) && data.length > 0
  }
  const { error } = await supabase.from("profiles").insert({ user_id: user.id, role, ...columns })
  return !error
}

/**
 * Termine l'onboarding étudiant.
 * @param {{
 *   fullName: string, city: string, phone: string, bio?: string,
 *   school: string, level: string, skills: string[], availability?: string[],
 *   avatarUrl?: string, cardUrl?: string, next?: string,
 * }} payload les autres clés sont ignorées
 * @returns {Promise<{ ok: true, destination: string }
 *   | { ok: false, code: string, message: string, fieldErrors?: Record<string, string> }>}
 */
export async function completeStudentOnboarding(payload) {
  const input = asObject(payload)
  const context = await loadContext("student", input.next)
  if (context.error) return context.error
  const { supabase, user, profile } = context

  const { fieldErrors, data } = collectErrors([
    makeStudentIdentitySchema().safeParse(input),
    makeStudentStudiesSchema().safeParse(input),
  ])
  const avatar = storageUrl(input.avatarUrl, "avatars", user.id)
  const card = storageUrl(input.cardUrl, "student-cards", user.id)
  if (!avatar.ok) fieldErrors.avatarUrl = "Cette photo n'est pas valide. Envoie-la à nouveau."
  if (!card.ok) fieldErrors.cardUrl = "Cette carte n'est pas valide. Envoie-la à nouveau."
  if (Object.keys(fieldErrors).length > 0) return failure("student", "invalid", { fieldErrors })

  const columns = {
    full_name: data.fullName,
    city: data.city,
    phone: data.phone,
    bio: data.bio || null,
  }
  if (avatar.url) columns.avatar_url = avatar.url
  if (card.url) columns.verification_submitted_at = new Date().toISOString()

  const saved = await writeProfile({ supabase, user, profile, role: "student", columns })
  if (!saved) return failure("student", "save_failed")

  const studentColumns = {
    user_id: user.id,
    school: data.school,
    level: data.level,
    skills: data.skills,
    availability: data.availability.length > 0 ? data.availability.join(", ") : null,
  }
  if (card.url) studentColumns.card_url = card.url

  const { error } = await supabase
    .from("student_profiles")
    .upsert(studentColumns, { onConflict: "user_id" })
  if (error) return failure("student", "save_failed")

  return {
    ok: true,
    destination: resolvePostAuth({ role: "student", profileComplete: true, next: input.next }),
  }
}

/**
 * Termine l'onboarding client. Le type de client reste dans `user_metadata.client_type`
 * (affichage seulement, jamais une autorisation).
 * @param {{ clientType: string, name: string, city: string, phone: string, avatarUrl?: string, next?: string }} payload
 *   les autres clés sont ignorées
 * @returns {Promise<{ ok: true, destination: string }
 *   | { ok: false, code: string, message: string, fieldErrors?: Record<string, string> }>}
 */
export async function completeClientOnboarding(payload) {
  const input = asObject(payload)
  const context = await loadContext("client", input.next)
  if (context.error) return context.error
  const { supabase, user, profile } = context

  const { fieldErrors, data } = collectErrors([
    makeClientTypeSchema().safeParse(input),
    makeClientIdentitySchema().safeParse(input),
  ])
  const avatar = storageUrl(input.avatarUrl, "avatars", user.id)
  if (!avatar.ok) fieldErrors.avatarUrl = "Ce logo n'est pas valide. Envoyez-le à nouveau."
  if (Object.keys(fieldErrors).length > 0) return failure("client", "invalid", { fieldErrors })

  const columns = { full_name: data.name, city: data.city, phone: data.phone }
  if (avatar.url) columns.avatar_url = avatar.url

  const saved = await writeProfile({ supabase, user, profile, role: "client", columns })
  if (!saved) return failure("client", "save_failed")

  // Échec toléré : le type n'est qu'un libellé d'affichage.
  await supabase.auth.updateUser({ data: { client_type: data.clientType } })

  return {
    ok: true,
    destination: resolvePostAuth({ role: "client", profileComplete: true, next: input.next }),
  }
}
