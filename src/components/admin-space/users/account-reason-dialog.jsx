// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { ReasonField, reasonError } from "@/components/admin-space/verifications/reset-dialog"

function Form({ onClose, onConfirm, title, description, notes, confirmLabel, tone }) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const sending = useRef(false)

  const submit = async () => {
    const problem = reasonError(reason)
    if (problem) {
      setError(problem)
      return
    }
    setPending(true)
    setError("")
    const outcome = await confirmOnce(sending, () => onConfirm({ reason: reason.trim() }))
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
      title={title}
      description={description}
      size="sm"
      tone={tone}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn btn--danger" : "btn btn--dark"}
            onClick={submit}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? "Envoi en cours" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="stack stack--3">
        <ReasonField
          reason={reason}
          error={error}
          onChange={(value) => {
            setReason(value)
            setError("")
          }}
        />
        {notes.map((note) => (
          <div key={note} className="a2-note">
            <Icon name="i-info" className="ic" />
            <span>{note}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/**
 * Boîte à motif obligatoire des actions de compte (suspendre, réactiver) : motif de 5 à 500 caractères, conséquences
 * en notes grises, double envoi impossible. `onConfirm({ reason })` renvoie `{ error }` en cas de refus.
 */
export function AccountReasonDialog({ open, ...props }) {
  if (!open) return null
  return <Form {...props} notes={props.notes ?? []} tone={props.tone ?? "default"} />
}

export default AccountReasonDialog
