// @ds-screen RD-ADMIN-01
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { useAppToast } from "@/components/app-ui/toast"
import { reactivateAccount, suspendAccount } from "@/lib/actions/admin-users.actions"
import { SuspendDialog } from "./suspend-dialog"
import { ReactivateDialog } from "./reactivate-dialog"

/**
 * Action de compte de la fiche : « Suspendre » (texte rouge) ou « Réactiver » (seul bouton encre d'une fiche
 * suspendue). Rendu seulement pour un compte qui n'est ni administrateur ni le compte connecté.
 */
export function AccountActions({ userId, name, isSuspended }) {
  const router = useRouter()
  const { success } = useAppToast()
  const [dialog, setDialog] = useState(null)

  const run = (action, title) => async ({ reason }) => {
    const result = await action(userId, { reason })
    if (result?.error) {
      router.refresh()
      return { error: result.error }
    }
    success(title)
    router.refresh()
    return undefined
  }

  return (
    <>
      {isSuspended ? (
        <button type="button" className="btn btn--dark" onClick={() => setDialog("reactivate")}>
          <Icon name="i-undo" />
          Réactiver
        </button>
      ) : (
        <button type="button" className="btn btn--danger-outline" onClick={() => setDialog("suspend")}>
          <Icon name="i-ban" />
          Suspendre
        </button>
      )}
      <SuspendDialog
        open={dialog === "suspend"}
        onClose={() => setDialog(null)}
        name={name}
        onConfirm={run(suspendAccount, `${name} est suspendu(e)`)}
      />
      <ReactivateDialog
        open={dialog === "reactivate"}
        onClose={() => setDialog(null)}
        name={name}
        onConfirm={run(reactivateAccount, `${name} est réactivé(e)`)}
      />
    </>
  )
}

export default AccountActions
