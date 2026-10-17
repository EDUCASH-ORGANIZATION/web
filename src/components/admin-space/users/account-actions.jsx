// @ds-screen RD-ADMIN-01
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { useAppToast } from "@/components/app-ui/toast"
import { closeAccount, reactivateAccount, reopenAccount, suspendAccount } from "@/lib/actions/admin-users.actions"
import { SuspendDialog } from "./suspend-dialog"
import { ReactivateDialog } from "./reactivate-dialog"
import { CloseAccountDialog } from "./close-account-dialog"
import { ReopenAccountDialog } from "./reopen-account-dialog"

/**
 * Actions de compte de la fiche. Compte actif : « Suspendre » (ou « Réactiver » la suspension) et « Fermer le compte »
 * (inactif tant qu'un blocage est listé). Compte fermé : « Réactiver le compte » seulement. Compte en cours d'effacement
 * ou clôturé : aucune action. Rendu seulement pour un compte qui n'est ni administrateur ni le compte connecté.
 */
export function AccountActions({ userId, name, isSuspended, closure }) {
  const router = useRouter()
  const { success, error: toastError } = useAppToast()
  const [dialog, setDialog] = useState(null)
  const state = closure?.state ?? "active"
  const blocked = (closure?.blockers ?? []).length > 0

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

  const runClosure = (action, title, incomplete) => async (input) => {
    const result = await action(userId, input)
    if (result?.error) {
      router.refresh()
      return { error: result.error }
    }
    if (result?.complete === false) toastError(title, incomplete)
    else success(title)
    router.refresh()
    return undefined
  }

  if (state === "pseudonymizing" || state === "pseudonymized") return null

  if (state === "closed") {
    return (
      <>
        <button type="button" className="btn btn--dark" onClick={() => setDialog("reopen")}>
          <Icon name="i-undo" />
          Réactiver le compte
        </button>
        <ReopenAccountDialog
          open={dialog === "reopen"}
          onClose={() => setDialog(null)}
          name={name}
          dueAt={closure?.dueAt ?? null}
          onConfirm={runClosure(
            reopenAccount,
            `Le compte de ${name} est réactivé`,
            "La connexion n'a pas pu être rétablie. Rechargez la page et réessayez.",
          )}
        />
      </>
    )
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
      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => setDialog("close")}
        disabled={blocked}
        aria-describedby={blocked ? "closure-blockers" : undefined}
      >
        <Icon name="i-lock" />
        Fermer le compte
      </button>
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
      <CloseAccountDialog
        open={dialog === "close"}
        onClose={() => setDialog(null)}
        name={name}
        onConfirm={runClosure(
          closeAccount,
          `Le compte de ${name} est fermé`,
          "Fermeture enregistrée, mais la coupure de connexion n'est pas terminée. Contactez l'équipe technique.",
        )}
      />
    </>
  )
}

export default AccountActions
