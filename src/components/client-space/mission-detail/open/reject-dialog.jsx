"use client"

import { ConfirmDialog } from "@/components/app-ui/confirm-dialog"
import { studentFirstName } from "./candidate-row"

/**
 * Refus d'une candidature (C04, C05) : confirmation simple, sans motif ni annulation différée.
 * `onConfirm` renvoie `{ error }` pour un refus métier (affiché tel quel dans la boîte).
 */
export function RejectDialog({ open, applicant, onClose, onConfirm }) {
  if (!open || !applicant) return null
  const first = studentFirstName(applicant.student)
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      steps={[
        {
          title: first ? `Refuser la candidature de ${first} ?` : "Refuser cette candidature ?",
          description: "Cette candidature ne sera plus en attente. Cette décision est définitive.",
          confirmLabel: "Refuser la candidature",
        },
      ]}
    />
  )
}

export default RejectDialog
