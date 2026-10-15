// @ds-screen RD-ADMIN-01
"use client"

import { AccountReasonDialog } from "./account-reason-dialog"

/** Réactivation d'un compte suspendu : motif obligatoire gardé dans le journal. */
export function ReactivateDialog({ open, onClose, onConfirm, name }) {
  return (
    <AccountReasonDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Réactiver ${name} ?`}
      description="Le compte pourra de nouveau se connecter. Indiquez le motif de la réactivation : il est conservé dans le journal."
      notes={["Les missions et l'argent en séquestre ne sont pas modifiés par la réactivation."]}
      confirmLabel="Réactiver le compte"
    />
  )
}

export default ReactivateDialog
