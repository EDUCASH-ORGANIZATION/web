// @ds-screen RD-ADMIN-01
"use client"

import { ReasonDialog } from "./reset-dialog"

/** Révocation d'un badge : motif obligatoire, repris dans l'e-mail envoyé à l'étudiant. */
export function RevokeDialog({ open, onClose, onConfirm, name }) {
  return (
    <ReasonDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Révoquer le badge de ${name} ?`}
      icon={{ name: "i-ban", tone: "erreur" }}
      description="Le badge est retiré et le motif est envoyé à l'étudiant par e-mail. Il pourra renvoyer une carte."
      confirmLabel="Révoquer le badge"
      tone="danger"
      visible
    />
  )
}

export default RevokeDialog
