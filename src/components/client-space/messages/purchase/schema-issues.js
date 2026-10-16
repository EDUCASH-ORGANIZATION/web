// Messages de validation des fenêtres de la carte « Demande de paiement » (client). Les règles et les textes
// restent dans `src/lib/purchases/requests.js` : on interroge ses schémas zod au lieu de les recopier.

/**
 * Premier message d'erreur du schéma pour chaque champ en erreur, indexé par le nom du champ.
 * @param {{ safeParse: (input: unknown) => { success: boolean, error?: { issues: Array<{ path: Array<string|number>, message: string }> } } }} schema
 * @param {unknown} input
 * @returns {Record<string, string>} vide si l'entrée est valide
 */
export function fieldIssues(schema, input) {
  const result = schema.safeParse(input)
  if (result.success) return {}
  const issues = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !Object.hasOwn(issues, key)) issues[key] = issue.message
  }
  return issues
}
