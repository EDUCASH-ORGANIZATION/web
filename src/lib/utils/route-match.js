// Vrai si pathname est exactement le préfixe ou un de ses sous-chemins.
// "/clients" ne correspond donc pas à "/client".
export function matchesRoutePrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}
