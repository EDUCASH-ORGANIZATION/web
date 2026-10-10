// Vrai si pathname est exactement le préfixe ou un de ses sous-chemins.
// "/client" ne correspond donc pas à "/clients" (qui redirige vers l'accueil dans le middleware).
export function matchesRoutePrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}
