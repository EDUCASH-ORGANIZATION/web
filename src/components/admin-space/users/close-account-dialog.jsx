// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { SelectField, TextField } from "@/components/app-ui/fields"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { CLOSURE_GRACE_DAYS, CLOSURE_REASONS, closureDueAt } from "@/lib/account-closure/closure-rules"
import { formatDateFr } from "@/lib/app/format"

export const CONFIRMATION_WORD = "FERMER"

/** Motifs de fermeture et de réactivation : liste fermée, codes de CLOSURE_REASONS. */
export const CLOSURE_REASON_OPTIONS = [
  { value: CLOSURE_REASONS.USER_REQUEST, label: "Demande du titulaire du compte" },
  { value: CLOSURE_REASONS.ADMIN_DECISION, label: "Décision de l'administration" },
]

function Form({ onClose, onConfirm, name, resume = false }) {
  const [reasonCode, setReasonCode] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const sending = useRef(false)
  const cancelRef = useRef(null)
  const dueLabel = formatDateFr(closureDueAt(new Date()))

  const submit = async () => {
    if (!reasonCode) {
      setError("Choisissez un motif dans la liste.")
      return
    }
    if (confirmation !== CONFIRMATION_WORD) {
      setError(`Saisissez ${CONFIRMATION_WORD} pour confirmer.`)
      return
    }
    setPending(true)
    setError("")
    const outcome = await confirmOnce(sending, () => onConfirm({ reasonCode, confirmation }))
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
      title={resume ? `Relancer la fermeture du compte de ${name} ?` : `Fermer le compte de ${name} ?`}
      description={
        resume
          ? "La fermeture est restée incomplète. Elle sera reprise avec les mêmes contrôles. Indiquez le motif de la fermeture."
          : "Action réversible pendant le délai de grâce et tracée. Indiquez le motif de la fermeture."
      }
      size="sm"
      tone="danger"
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={submit}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? "Envoi en cours" : resume ? "Relancer la fermeture" : "Fermer le compte"}
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
        />
        <TextField
          label={`Saisissez ${CONFIRMATION_WORD} pour confirmer`}
          required
          autoComplete="off"
          value={confirmation}
          onChange={(e) => {
            setConfirmation(e.target.value)
            setError("")
          }}
          error={error || undefined}
        />
        <div className="a2-note">
          <Icon name="i-info" className="ic" />
          <span>Le compte est suspendu et ne peut plus se connecter. Les données restent intactes pendant le délai de grâce.</span>
        </div>
        <div className="a2-note">
          <Icon name="i-info" className="ic" />
          <span>
            Vous pouvez le réactiver jusqu&apos;au {dueLabel} ({CLOSURE_GRACE_DAYS} jours). Passé ce délai, les données personnelles sont
            effacées et la réactivation devient impossible.
          </span>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Fermeture d'un compte : motif en liste fermée, confirmation par la saisie de « FERMER », rappel des conséquences et
 * de l'échéance. Avec `resume` : reprise d'une fermeture inachevée, mêmes contrôles. `onConfirm({ reasonCode, confirmation })` renvoie `{ error }` en cas de refus.
 */
export function CloseAccountDialog({ open, ...props }) {
  if (!open) return null
  return <Form {...props} />
}

export default CloseAccountDialog
