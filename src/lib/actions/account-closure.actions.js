"use server"

import { redirect } from "next/navigation"
import { createClient as createEphemeralClient } from "@supabase/supabase-js"
import { requireRole } from "@/lib/auth/require-role"
import { revokeSession } from "@/lib/auth/revoke-session"
import { createServiceClient } from "@/lib/supabase/service"
import {
  ACTOR_KINDS,
  CLOSURE_REASONS,
  blockerMessage,
  closureBlockers,
  closureDueAt,
} from "@/lib/account-closure/closure-rules"
import { closeAccountCore, readClosureSnapshot } from "./account-closure-core"

/**
 * Fermeture de compte en libre-service (RD-CLOSE-01), clients et étudiants. Contrôles dans l'ordre : rôle, confirmation
 * « FERMER », limitation des tentatives, mot de passe, et seulement ensuite le client service role.
 *
 * Mot de passe : contrôle par `signInWithPassword` sur un client supabase-js éphémère (clé anon, aucune persistance
 * de session, aucun cookie) : la session courante n'est ni remplacée ni modifiée. Si le contrôle ouvre une session
 * côté Supabase, elle est fermée aussitôt (portée locale) ; la fermeture réussie révoque de toute façon toutes les
 * sessions (portée globale).
 *
 * Limitation : `auth.actions.js` n'a pas de mécanisme maison (il s'appuie sur la limite de Supabase Auth, code
 * `rate_limited`, relayée ici). On ajoute un compteur d'échecs par utilisateur, en mémoire du processus serveur :
 * MAX_FAILED_ATTEMPTS échecs sur WINDOW_MS bloquent les essais suivants jusqu'à la fin de la fenêtre. Sur un
 * hébergement sans état il est best-effort par instance, la limite de Supabase Auth reste le filet commun.
 */

const CONFIRMATION_WORD = "FERMER"
const MAX_FAILED_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const MAX_TRACKED_USERS = 1000

const ERR_CONFIRMATION = "Saisissez FERMER pour confirmer la fermeture."
const ERR_PASSWORD_REQUIRED = "Saisissez votre mot de passe pour confirmer."
const ERR_PASSWORD = "Le mot de passe est incorrect."
const ERR_TOO_MANY = "Trop de tentatives. Réessayez dans quelques minutes."
const ERR_NETWORK = "Connexion impossible. Vérifiez votre réseau et réessayez."
const ERR_GENERIC = "La fermeture n'a pas pu aboutir. Réessayez dans un instant."
const ERR_PREVIEW = "Les informations n'ont pas pu être chargées. Réessayez dans un instant."
const ERR_BLOCKED = "Votre compte ne peut pas être fermé pour le moment."

/** userId -> { count, resetAt } */
const failures = new Map()

function recentFailures(userId, now) {
  const entry = failures.get(userId)
  if (!entry) return 0
  if (entry.resetAt <= now) {
    failures.delete(userId)
    return 0
  }
  return entry.count
}

function recordFailure(userId, now) {
  const entry = failures.get(userId)
  if (entry && entry.resetAt > now) {
    entry.count += 1
    return
  }
  if (failures.size >= MAX_TRACKED_USERS) {
    for (const [key, value] of failures) if (value.resetAt <= now) failures.delete(key)
    if (failures.size >= MAX_TRACKED_USERS) failures.delete(failures.keys().next().value)
  }
  failures.set(userId, { count: 1, resetAt: now + WINDOW_MS })
}

function toBlockers(codes) {
  return codes.map((code) => ({ code, message: blockerMessage(code, "self") }))
}

/**
 * Contrôle le mot de passe sans toucher à la session courante.
 * @returns {Promise<"ok" | "invalid" | "rate_limited" | "error">}
 */
async function checkPassword(email, password) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || typeof email !== "string" || !email) return "error"
  try {
    const probe = createEphemeralClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { error } = await probe.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.status === 429 || error.code === "over_request_rate_limit") return "rate_limited"
      if (error.code === "invalid_credentials" || error.status === 400) return "invalid"
      return "error"
    }
    await probe.auth.signOut({ scope: "local" }).catch(() => {})
    return "ok"
  } catch {
    return "error"
  }
}

/**
 * Aperçu des blocages de fermeture de l'appelant et de la fin du délai de grâce si l'on fermait maintenant.
 * @returns {Promise<{ blockers: { code: string, message: string }[], dueAt: string } | { error: string }>}
 */
export async function getMyClosurePreview() {
  const auth = await requireRole(["client", "student"])
  if (auth.error) return { error: auth.error }

  try {
    const now = new Date()
    const snapshot = await readClosureSnapshot(createServiceClient(), auth.user.id, { now })
    return { blockers: toBlockers(closureBlockers(snapshot)), dueAt: closureDueAt(now).toISOString() }
  } catch {
    console.error("[account-closure] preview", "exception")
    return { error: ERR_PREVIEW }
  }
}

/**
 * Ferme le compte de l'appelant (réversible pendant le délai de grâce). Champs : confirmation, password.
 * Succès : toutes les sessions sont révoquées puis redirection vers la page « fermeture enregistrée ».
 * @param {object | null} _prev
 * @param {FormData} formData
 * @returns {Promise<{ error: string, blockers?: { code: string, message: string }[] }>}
 */
export async function closeMyAccount(_prev, formData) {
  const auth = await requireRole(["client", "student"])
  if (auth.error) return { error: auth.error }

  const confirmation = formData?.get?.("confirmation")
  const password = formData?.get?.("password")
  if (confirmation !== CONFIRMATION_WORD) {
    return { error: ERR_CONFIRMATION }
  }
  if (typeof password !== "string" || password === "") return { error: ERR_PASSWORD_REQUIRED }

  const { supabase, user } = auth
  const now = Date.now()
  if (recentFailures(user.id, now) >= MAX_FAILED_ATTEMPTS) return { error: ERR_TOO_MANY }

  const check = await checkPassword(user.email, password)
  if (check === "invalid") {
    recordFailure(user.id, now)
    return { error: ERR_PASSWORD }
  }
  if (check === "rate_limited") return { error: ERR_TOO_MANY }
  if (check !== "ok") return { error: ERR_NETWORK }
  failures.delete(user.id)

  let result
  try {
    result = await closeAccountCore(createServiceClient(), {
      userId: user.id,
      actor: { kind: ACTOR_KINDS.SELF },
      reasonCode: CLOSURE_REASONS.USER_REQUEST,
    })
  } catch {
    console.error("[account-closure] close", "exception")
    return { error: ERR_GENERIC }
  }

  if (result.blocked) return { error: ERR_BLOCKED, blockers: toBlockers(result.blocked) }
  if (!result.success || !result.complete || !result.dueAt) return { error: ERR_GENERIC }

  await revokeSession(supabase, { scope: "global" })
  redirect(`/compte-ferme?jusquau=${encodeURIComponent(result.dueAt)}`)
}
