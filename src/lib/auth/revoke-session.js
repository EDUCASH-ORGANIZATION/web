import { cookies } from "next/headers"

/**
 * Ferme la session Supabase. Si la révocation échoue, les cookies de session (sb-*) sont supprimés
 * explicitement : un échec ne doit jamais laisser une session ouverte.
 * Options de cookie à aligner si un `cookieOptions.domain` est ajouté un jour au client Supabase
 * (la suppression doit viser le même domaine et le même chemin que l'écriture).
 * @param {{ auth: { signOut: () => Promise<{ error?: unknown } | undefined> } }} supabase
 */
export async function revokeSession(supabase) {
  const { error } = (await supabase.auth.signOut()) ?? {}
  if (!error) return
  const store = await cookies()
  for (const { name } of store.getAll()) {
    if (name.startsWith("sb-")) store.delete(name)
  }
}
