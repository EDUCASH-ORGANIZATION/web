// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { TextareaField } from "@/components/app-ui/fields"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { useAppToast } from "@/components/app-ui/toast"
import { dismissReport, resolveReport, takeReport } from "@/lib/actions/admin-reports.actions"
import { REPORT_NOTE_MAX, reportActions } from "@/lib/admin-space/reports"

const COPY = {
  resolve: {
    title: (ref) => `Résoudre ${ref} ?`,
    description:
      "Le signalement passe en résolu. Aucune suspension n'est appliquée automatiquement : si un compte doit être suspendu, cette décision se prend depuis sa fiche.",
    confirm: "Résoudre",
    done: "Signalement résolu",
  },
  dismiss: {
    title: (ref) => `Classer ${ref} sans suite ?`,
    description: "Le signalement passe en classé. Vous pouvez indiquer la raison dans la note.",
    confirm: "Classer sans suite",
    done: "Signalement classé",
  },
}

function DecisionForm({ kind, reference, onClose, onConfirm }) {
  const copy = COPY[kind]
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const sending = useRef(false)
  const cancelRef = useRef(null)

  const submit = async () => {
    if (note.trim().length > REPORT_NOTE_MAX) {
      setError(`La note ne peut pas dépasser ${REPORT_NOTE_MAX} caractères.`)
      return
    }
    setPending(true)
    setError("")
    const outcome = await confirmOnce(sending, () => onConfirm({ note: note.trim() }))
    if (outcome.skipped) return
    setPending(false)
    if (outcome.error) {
      setError(outcome.error)
      return
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!pending) onClose()
      }}
      title={copy.title(reference)}
      description={copy.description}
      size="sm"
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button type="button" className="btn btn--dark" onClick={submit} disabled={pending} aria-busy={pending ? "true" : undefined}>
            {pending ? "Envoi en cours" : copy.confirm}
          </button>
        </>
      }
    >
      <TextareaField
        label="Note"
        optional
        help="Visible de l'équipe seulement. N'indiquez pas de coordonnées personnelles."
        maxLength={REPORT_NOTE_MAX}
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          setError("")
        }}
        error={error || undefined}
        rows={4}
      />
    </Modal>
  )
}

/**
 * Boîte de décision d'un signalement (résoudre ou classer) : note facultative de 500 caractères au plus, envoi
 * unique (le verrou ignore un second clic). `onConfirm({ note })` renvoie `{ error }` en cas de refus.
 */
export function ReportDecisionDialog({ open, kind, reference, onClose, onConfirm }) {
  if (!open) return null
  return <DecisionForm kind={kind} reference={reference} onClose={onClose} onConfirm={onConfirm} />
}

/**
 * Actions d'un signalement : « Prendre en charge » (seul bouton encre d'un signalement ouvert), puis « Résoudre »
 * (seul bouton encre d'un signalement en cours) et « Classer » (bouton léger). Résoudre et Classer restent inactifs
 * tant que personne n'a pris le signalement en charge. Aucune suspension depuis cet écran.
 */
export function ReportActions({ reportId, reference, status }) {
  const router = useRouter()
  const { success, error } = useAppToast()
  const [dialog, setDialog] = useState(null)
  const [taking, setTaking] = useState(false)
  const takeLock = useRef(false)
  const can = reportActions(status)

  const take = async () => {
    const outcome = await confirmOnce(takeLock, async () => {
      setTaking(true)
      return takeReport(reportId)
    })
    if (outcome.skipped) return
    setTaking(false)
    if (outcome.error) error("Prise en charge impossible", outcome.error)
    else success("Signalement pris en charge")
    router.refresh()
  }

  const decide = (action, kind) => async ({ note }) => {
    const result = await action(reportId, { note })
    router.refresh()
    if (result?.error) return { error: result.error }
    success(COPY[kind].done)
    return undefined
  }

  if (!can.take && !can.close) {
    return <p className="caption">Ce signalement est clos. Il n&apos;y a plus d&apos;action possible.</p>
  }

  return (
    <div className="a2-10-actions">
      {can.take ? (
        <button type="button" className="btn btn--dark" onClick={take} disabled={taking} aria-busy={taking ? "true" : undefined}>
          <Icon name="i-user-check" />
          {taking ? "Envoi en cours" : "Prendre en charge"}
        </button>
      ) : null}
      <button type="button" className={can.close ? "btn btn--dark" : "btn btn--secondary"} disabled={!can.close} onClick={() => setDialog("resolve")}>
        <Icon name="i-check-circle" />
        Résoudre
      </button>
      <button type="button" className="btn btn--ghost" disabled={!can.close} onClick={() => setDialog("dismiss")}>
        Classer sans suite
      </button>
      {can.take ? <p className="caption">Prenez le signalement en charge pour décider.</p> : null}
      <ReportDecisionDialog
        open={dialog === "resolve"}
        kind="resolve"
        reference={reference}
        onClose={() => setDialog(null)}
        onConfirm={decide(resolveReport, "resolve")}
      />
      <ReportDecisionDialog
        open={dialog === "dismiss"}
        kind="dismiss"
        reference={reference}
        onClose={() => setDialog(null)}
        onConfirm={decide(dismissReport, "dismiss")}
      />
    </div>
  )
}

export default ReportActions
