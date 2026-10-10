import { cookies } from "next/headers"

/**
 * Ferme la session Supabase. Si la révocation échoue, les cookies de session (sb-*) sont supprimés
 * explicitement : un échec ne doit jamais laisser une session ouverte.
 * Sans option, l'appel reste `signOut()` tel quel (portée par défaut de Supabase, inchangée).
 * `scope: "local"` ne ferme que la session courante ; `scope: "global"` ferme toutes les sessions
 * de l'utilisateur (ex. après un changement de mot de passe).
 * Options de cookie à aligner si un `cookieOptions.domain` est ajouté un jour au client Supabase
 * (la suppression doit viser le même domaine et le même chemin que l'écriture).
 * @param {{ auth: { signOut: (options?: { scope: "local" | "global" }) => Promise<{ error?: unknown } | undefined> } }} supabase
 * @param {{ scope?: "local" | "global" }} [options]
 */
export async function revokeSession(supabase, options) {
  const scope = options?.scope
  const { error } = (await (scope ? supabase.auth.signOut({ scope }) : supabase.auth.signOut())) ?? {}
  if (!error) return
  const store = await cookies()
  for (const { name } of store.getAll()) {
    if (name.startsWith("sb-")) store.delete(name)
  }
}
