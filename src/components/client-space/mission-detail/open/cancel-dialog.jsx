"use client"

import { ConfirmDialog } from "@/components/app-ui/confirm-dialog"
import { formatAmount } from "@/lib/app/format"

/**
 * Étapes de la confirmation d'annulation (C07). `refundAmount` : montant réservé au grand livre (0 si inconnu,
 * le texte ne promet alors aucun montant).
 */
export function cancelSteps({ title, refundAmount }) {
  const known = refundAmount > 0
  return [
    {
      title: "Annuler cette mission ?",
      description: known
        ? `La mission sort tout de suite des recherches. Les ${formatAmount(refundAmount)} réservés reviennent immédiatement et en entier sur votre portefeuille.`
        : "La mission sort tout de suite des recherches. Le séquestre éventuel revient immédiatement et en entier sur votre portefeuille.",
      confirmLabel: "Continuer",
    },
    {
      title: "Confirmer l'annulation",
      description: `C'est définitif : « ${title} » passe au statut Annulée et ne peut plus être rouverte. Vous pourrez la dupliquer ensuite.`,
      confirmLabel: known ? `Oui, annuler et rembourser ${formatAmount(refundAmount)}` : "Oui, annuler la mission",
    },
  ]
}

/**
 * Annulation d'une mission ouverte, en deux étapes (la seconde, en rouge plein, est irréversible).
 * `onConfirm` renvoie `{ error }` pour un refus (affiché tel quel, la boîte reste ouverte).
 */
export function CancelDialog({ open, mission, refundAmount, onClose, onConfirm }) {
  if (!open) return null
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      tone="danger"
      cancelLabel="Garder la mission"
      steps={cancelSteps({ title: mission.title, refundAmount })}
    />
  )
}

export default CancelDialog
