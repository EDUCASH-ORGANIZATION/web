// @ds-screen RD-ADMIN-01
"use client"

import { ConfirmDialog } from "@/components/app-ui/confirm-dialog"
import { formatDateFr } from "@/lib/app/format"

/**
 * Confirmation de validation : récapitulatif du badge (valable jusqu'au) puis « Valider et passer au suivant »
 * (ou « Valider la carte » quand le passage au dossier suivant est désactivé).
 * `onConfirm` renvoie `{ error }` en cas de refus (le message reste affiché, la boîte reste ouverte).
 */
export function ApproveDialog({ open, onClose, onConfirm, name, badgeUntil, advance = true }) {
  const until = formatDateFr(badgeUntil)
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      steps={[
        {
          title: `Valider la carte de ${name} ?`,
          description: `Le badge sera valable jusqu'au ${until}. L'étudiant en sera informé par e-mail.`,
          confirmLabel: advance ? "Valider et passer au suivant" : "Valider la carte",
        },
      ]}
    />
  )
}

export default ApproveDialog
