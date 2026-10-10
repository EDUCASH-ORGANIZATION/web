const NEUTRAL_MESSAGE = "L'opération sur le portefeuille n'a pas pu être effectuée."

/**
 * Appelle une fonction RPC du portefeuille (`wallet_reserve`, `wallet_release`, `wallet_refund`...).
 * À utiliser avec le client service role, côté serveur, après contrôle d'identité et de propriété.
 * Le résultat est réussi seulement si `error` est nul ET `data.success === true`.
 * Le détail technique reste dans la console serveur : l'appelant ne reçoit qu'un message neutre.
 * @param {{ rpc: (name: string, params: object) => PromiseLike<{ data: any, error: any }> }} client
 * @param {string} name nom de la fonction SQL
 * @param {object} params paramètres de la fonction
 * @returns {Promise<{ ok: true, data: any } | { ok: false, error: string, code: string|null }>}
 *   `code` reprend le champ `error` renvoyé par la fonction SQL (ex. `insufficient_balance`) quand il existe.
 */
export async function callWalletRpc(client, name, params) {
  let result
  try {
    result = await client.rpc(name, params)
  } catch (err) {
    console.error(`[wallet] ${name} : appel impossible`, err)
    return { ok: false, error: NEUTRAL_MESSAGE, code: null }
  }

  const { data, error } = result ?? {}
  if (error) {
    console.error(`[wallet] ${name} : erreur RPC`, error)
    return { ok: false, error: NEUTRAL_MESSAGE, code: null }
  }
  if (data?.success !== true) {
    const code = typeof data?.error === "string" ? data.error : null
    console.error(`[wallet] ${name} : refusé`, data)
    return { ok: false, error: NEUTRAL_MESSAGE, code }
  }
  return { ok: true, data }
}
