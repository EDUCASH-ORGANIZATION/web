// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { SelectField } from "@/components/app-ui/fields"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { formatDateFr } from "@/lib/app/format"
import { CLOSURE_REASON_OPTIONS } from "./close-account-dialog"

function Form({ onClose, onConfirm, name, dueAt }) {
  const [reasonCode, setReasonCode] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const sending = useRef(false)
  const cancelRef = useRef(null)

  const submit = async () => {
    if (!reasonCode) {
      setError("Choisissez un motif dans la liste.")
      return
    }
    setPending(true)
    setError("")
    const outcome = await confirmOnce(sending, () => onConfirm({ reasonCode }))
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
      title={`Réactiver le compte de ${name} ?`}
      description="Le compte pourra de nouveau se connecter. Indiquez le motif de la réactivation."
      size="sm"
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--dark"
            onClick={submit}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? "Envoi en cours" : "Réactiver le compte"}
          </button>
        </>
      }
    >
      <div className="stack stack--3">
        <SelectField
          label="Motif"
          required
          placeholder="Choisir un motif"
          options={CLOSURE_REASON_OPTIONS}
          value={reasonCode}
          onChange={(value) => {
            setReasonCode(value)
            setError("")
          }}
          error={error || undefined}
        />
        <div className="a2-note">
          <Icon name="i-info" className="ic" />
          <span>La suspension posée à la fermeture est retirée, sauf si le compte était déjà suspendu avant.</span>
        </div>
        {dueAt ? (
          <div className="a2-note">
            <Icon name="i-info" className="ic" />
            <span>La réactivation reste possible jusqu&apos;au {formatDateFr(dueAt)}. Ensuite, les données personnelles sont effacées.</span>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

/** Réactivation d'un compte fermé (avant l'effacement des données) : motif en liste fermée et rappel de l'échéance. */
export function ReopenAccountDialog({ open, ...props }) {
  if (!open) return null
  return <Form {...props} />
}

export default ReopenAccountDialog
