// Drapeau unique des paiements (recharge, retrait, publication de mission).
// Lu côté serveur seulement (process.env.PAYMENTS_ENABLED, jamais NEXT_PUBLIC) : faux par défaut,
// vrai uniquement si la variable vaut exactement "true". Les composants client le reçoivent par props.
// Appeler cette fonction dans un composant client donnerait toujours faux : ne pas le faire.

/** @returns {boolean} */
export function paymentsEnabled() {
  return process.env.PAYMENTS_ENABLED === "true"
}

/** Libellés partagés de l'état « en cours d'activation » (une version par tonalité). */
export const PAYMENTS_PENDING_COPY = {
  wallet: {
    title: "Recharge et retrait en cours d'activation",
    client: "Vos fonds restent en sécurité sur votre portefeuille EduCash. Vous pourrez recharger et retirer dès l'ouverture.",
    student: "Tes gains restent en sécurité sur ton portefeuille EduCash. Tu pourras retirer dès l'ouverture.",
  },
  publish: {
    title: "Publication en cours d'activation",
    lead: "La publication de missions ouvre dès que le paiement est activé. Votre argent restera bloqué jusqu'à ce que vous validiez le travail.",
  },
}
