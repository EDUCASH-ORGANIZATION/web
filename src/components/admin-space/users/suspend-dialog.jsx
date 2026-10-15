// @ds-screen RD-ADMIN-01
"use client"

import { AccountReasonDialog } from "./account-reason-dialog"

/** Suspension d'un compte : sans durée, jusqu'à réactivation manuelle. Aucun e-mail n'est envoyé au compte. */
export function SuspendDialog({ open, onClose, onConfirm, name }) {
  return (
    <AccountReasonDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Suspendre ${name} ?`}
      description="Action réversible et tracée. Indiquez le motif de la suspension : il est conservé dans le journal."
      notes={[
        "Le compte ne peut plus se connecter. Les missions et l'argent en séquestre restent en l'état.",
        "La suspension dure jusqu'à une réactivation manuelle. Le compte n'est pas prévenu par e-mail.",
      ]}
      confirmLabel="Suspendre le compte"
      tone="danger"
    />
  )
}

export default SuspendDialog
