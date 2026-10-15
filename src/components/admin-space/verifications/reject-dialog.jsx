// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { RadioGroupField, TextareaField } from "@/components/app-ui/fields"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { ADMIN_REJECTION_REASONS, MESSAGE_MAX, OTHER_REASON } from "@/lib/admin-space/decision-schemas"

const REASON_OPTIONS = ADMIN_REJECTION_REASONS.map((value) => ({ value, label: value }))

/** Erreur de saisie du refus (réécrite côté serveur) ou chaîne vide. */
export function rejectFormError({ reason, message }) {
  if (!reason) return "Choisissez un motif de la liste."
  if (reason === OTHER_REASON && message.trim() === "") return "Précisez le motif du refus."
  return ""
}

function Preview({ firstName, reason, message }) {
  const shownReason = reason === OTHER_REASON ? message.trim() : reason
  const note = reason === OTHER_REASON ? "" : message.trim()
  return (
    <div className="a2-note" role="group" aria-label="Aperçu de l'e-mail envoyé à l'étudiant">
      <Icon name="i-mail" className="ic" />
      <div>
        <b>Aperçu de l&apos;e-mail</b>
        <p>Bonjour {firstName},</p>
        <p>
          Notre équipe a examiné votre dossier mais n&apos;a pas pu valider votre carte étudiante pour la raison suivante :{" "}
          <b>{shownReason || "motif à choisir"}</b>
        </p>
        {note ? <p>{note}</p> : null}
        <p>Vous pouvez envoyer une nouvelle carte depuis votre profil.</p>
      </div>
    </div>
  )
}

function RejectForm({ onClose, onConfirm, name }) {
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const sending = useRef(false)
  const firstName = name.trim().split(/\s+/)[0] || "Étudiant"

  const submit = async () => {
    const problem = rejectFormError({ reason, message })
    if (problem) {
      setError(problem)
      return
    }
    setPending(true)
    setError("")
    const outcome = await confirmOnce(sending, () => onConfirm({ reason, message: message.trim() }))
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
      title={`Refuser la carte de ${name}`}
      description="L'étudiant recevra ce motif par e-mail et pourra renvoyer une carte."
      tone="danger"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={submit}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? "Envoi en cours" : "Refuser la carte"}
          </button>
        </>
      }
    >
      <div className="stack stack--3">
        <RadioGroupField
          legend="Motif du refus"
          name="motif"
          options={REASON_OPTIONS}
          value={reason}
          onChange={(value) => {
            setReason(value)
            setError("")
          }}
          required
        />
        <TextareaField
          label={reason === OTHER_REASON ? "Précisez le motif" : "Message pour l'étudiant"}
          optional={reason !== OTHER_REASON}
          required={reason === OTHER_REASON}
          maxLength={MESSAGE_MAX}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            setError("")
          }}
          rows={3}
        />
        <Preview firstName={firstName} reason={reason} message={message} />
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

/** Refus d'une carte : motif parmi 7, message facultatif (obligatoire pour « Autre motif »), aperçu de l'e-mail. */
export function RejectDialog({ open, onClose, onConfirm, name }) {
  if (!open) return null
  return <RejectForm onClose={onClose} onConfirm={onConfirm} name={name} />
}

export default RejectDialog
