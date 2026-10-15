// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { TextareaField } from "@/components/app-ui/fields"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { REASON_MAX, REASON_MIN } from "@/lib/admin-space/decision-schemas"

/** Erreur de saisie d'un motif libre (5 à 500 caractères) ou chaîne vide. */
export function reasonError(reason) {
  const text = reason.replace(/\s+/g, " ").trim()
  return text.length < REASON_MIN ? `Le motif doit contenir au moins ${REASON_MIN} caractères.` : ""
}

function ReasonForm({ onClose, onConfirm, title, description, confirmLabel, tone }) {
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
        <TextareaField
          label="Motif"
          required
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setError("")
          }}
          rows={3}
        />
        {error ? (
          <div className="field__error" role="alert">
            <Icon name="i-alert-circle" />
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

/** Boîte à motif obligatoire, commune à la réinitialisation d'un refus et à la révocation d'un badge. */
export function ReasonDialog({ open, onClose, onConfirm, title, description, confirmLabel, tone = "default" }) {
  if (!open) return null
  return (
    <ReasonForm
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={tone}
    />
  )
}

/** Réinitialisation d'un refus : l'étudiant pourra renvoyer une carte. Le motif de l'administrateur est journalisé. */
export function ResetDialog({ open, onClose, onConfirm, name }) {
  return (
    <ReasonDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Réinitialiser le refus de ${name}`}
      description="Le motif de refus est effacé : l'étudiant pourra renvoyer une carte. Indiquez pourquoi vous le faites."
      confirmLabel="Réinitialiser le refus"
    />
  )
}

export default ResetDialog
