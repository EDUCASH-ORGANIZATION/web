// Adaptateur d'identité auth de la fermeture de compte (RD-CLOSE-01). Seul module qui modifie `auth.users`
// (à remplacer au passage à Neon). Module serveur sans "use server" : aucune action appelable depuis le navigateur.
// Chaque fonction fait un seul appel `auth.admin.updateUserById`, ne supprime jamais l'utilisateur, ne touche
// jamais `app_metadata`, ne lève jamais d'exception et ne journalise que le code d'erreur (jamais d'adresse
// ni de mot de passe).
import "server-only"
import { randomBytes } from "node:crypto"
import { pseudonymousEmail } from "@/lib/account-closure/closure-rules"

// Environ 100 ans : un compte fermé reste banni jusqu'à une réactivation explicite par l'admin.
const BAN_FOREVER = "876000h"
const UNBAN = "none"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PASSWORD_BYTES = 32
// GoTrue fusionne les métadonnées : une clé n'est effacée que si elle vaut null. Liste fermée des clés connues,
// toujours envoyées à null, en plus des clés réellement présentes.
const KNOWN_METADATA_KEYS = [
  "email",
  "email_verified",
  "phone_verified",
  "sub",
  "full_name",
  "name",
  "phone",
  "avatar_url",
  "client_type",
  "role",
]

/** Objet { clé: null } pour les clés présentes et la liste fermée ; aucune valeur existante n'est conservée. */
function nullMetadata(existing) {
  const keys = existing && typeof existing === "object" && !Array.isArray(existing) ? Object.keys(existing) : []
  return Object.fromEntries([...new Set([...keys, ...KNOWN_METADATA_KEYS])].map((key) => [key, null]))
}

/** Lit l'utilisateur auth juste avant l'écriture ; en cas d'échec, la liste fermée seule suffit (jamais bloquant). */
async function readAuthUser(service, userId) {
  try {
    const result = await service.auth.admin.getUserById(userId)
    return result?.error ? null : result
  } catch {
    return null
  }
}

/**
 * @param {string} label
 * @param {import("@supabase/supabase-js").SupabaseClient} service
 * @param {string} userId
 * @param {() => object | Promise<object>} buildAttributes
 * @returns {Promise<{ ok: true } | { ok: false, code: string }>}
 */
async function updateAuthUser(label, service, userId, buildAttributes) {
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    return { ok: false, code: "invalid_user_id" }
  }
  try {
    const { error } = await service.auth.admin.updateUserById(userId, await buildAttributes())
    if (error) {
      const code = String(error.code ?? error.status ?? "erreur")
      console.error(`[account-closure-auth] ${label}`, code)
      return { ok: false, code }
    }
    return { ok: true }
  } catch {
    console.error(`[account-closure-auth] ${label}`, "exception")
    return { ok: false, code: "exception" }
  }
}

/**
 * Bannit le compte auth (idempotent).
 * @param {import("@supabase/supabase-js").SupabaseClient} service
 * @param {string} userId
 */
export function banAuthUser(service, userId) {
  return updateAuthUser("ban", service, userId, () => ({ ban_duration: BAN_FOREVER }))
}

/**
 * Lève le ban du compte auth (idempotent).
 * @param {import("@supabase/supabase-js").SupabaseClient} service
 * @param {string} userId
 */
export function unbanAuthUser(service, userId) {
  return updateAuthUser("unban", service, userId, () => ({ ban_duration: UNBAN }))
}

/**
 * Remplace l'adresse par l'adresse pseudonyme, le mot de passe par une valeur aléatoire et met à null toutes les clés
 * des métadonnées utilisateur (lues juste avant, plus une liste fermée). Le compte reste banni (idempotent : la reprise réécrit les mêmes valeurs, mot de passe renouvelé).
 * @param {import("@supabase/supabase-js").SupabaseClient} service
 * @param {string} userId
 */
export function pseudonymizeAuthUser(service, userId) {
  return updateAuthUser("pseudonymize", service, userId, async () => {
    const existing = await readAuthUser(service, userId)
    return {
      email: pseudonymousEmail(userId),
      email_confirm: true,
      password: randomBytes(PASSWORD_BYTES).toString("hex"),
      user_metadata: nullMetadata(existing?.data?.user?.user_metadata),
      ban_duration: BAN_FOREVER,
    }
  })
}
