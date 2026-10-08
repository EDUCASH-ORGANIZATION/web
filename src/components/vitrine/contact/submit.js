export const SEND_FAILED_MESSAGE =
  "L'envoi a échoué. Ton message est conservé, vérifie ta connexion et réessaie dans un instant."

/**
 * Envoie le formulaire via l'action serveur et ramène tout échec technique à un état "error".
 * @param {FormData} formData
 * @param {(formData: FormData) => Promise<object>} send
 */
export async function submitContact(formData, send) {
  try {
    const result = await send(formData)
    if (result?.status === "success" || result?.status === "invalid" || result?.status === "error") {
      return result
    }
    return { status: "error", message: SEND_FAILED_MESSAGE }
  } catch {
    return { status: "error", message: SEND_FAILED_MESSAGE }
  }
}

export function formatCount(length, max) {
  return `${length} / ${new Intl.NumberFormat("fr-FR").format(max).replace(/\s/g, " ")}`
}
