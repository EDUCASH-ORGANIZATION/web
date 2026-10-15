// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { Modal } from "@/components/app-ui/modal"
import { RadioGroupField, TextareaField } from "@/components/app-ui/fields"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { VISIBLE_REASON_HELP } from "./reset-dialog"
import { ADMIN_REJECTION_REASONS, MESSAGE_MAX, OTHER_REASON } from "@/lib/admin-space/decision-schemas"

const REASON_OPTIONS = ADMIN_REJECTION_REASONS.map((value) => ({ value, label: value }))

/** Erreur de saisie du refus (réécrite côté serveur) ou chaîne vide. */
export function rejectFormError({ reason, message }) {
  if (!reason) return "Choisissez un motif de la liste."
  if (reason === OTHER_REASON && message.trim() === "") return "Précisez le motif du refus."
  return ""
}

/** Champ qui porte l'erreur : « Précisez le motif » va au texte, tout le reste (motif manquant, refus serveur) au groupe de motifs. */
function errorField({ reason, message }, problem) {
  return problem && reason === OTHER_REASON && message.trim() === "" ? "message" : "reason"
}

/**
 * Champs du refus : l'erreur est reliée au champ concerné (aria-describedby, aria-invalid) au lieu d'une alerte à part.
 * @param {{ reason: string, message: string, error: { field: "reason" | "message", text: string } | null,
 *   onReason: (value: string) => void, onMessage: (value: string) => void }} props
 */
export function RejectFields({ reason, message, error, onReason, onMessage }) {
  return (
    <>
      <RadioGroupField
        legend="Motif du refus"
        name="motif"
        options={REASON_OPTIONS}
        value={reason}
        onChange={onReason}
        error={error?.field === "reason" ? error.text : undefined}
        required
      />
      <TextareaField
        label={reason === OTHER_REASON ? "Précisez le motif" : "Message pour l'étudiant"}
        help={VISIBLE_REASON_HELP}
        optional={reason !== OTHER_REASON}
        required={reason === OTHER_REASON}
        maxLength={MESSAGE_MAX}
        value={message}
        onChange={(e) => onMessage(e.target.value)}
        error={error?.field === "message" ? error.text : undefined}
        rows={3}
      />
    </>
  )
}

function Preview({ firstName, reason, message }) {
  const shownReason = reason === OTHER_REASON ? message.trim() : reason
  const note = reason === OTHER_REASON ? "" : message.trim()
  return (
    <div className="ad-mail" role="group" aria-label="Aperçu de l'e-mail envoyé à l'étudiant">
      <div className="caption">Aperçu de l&apos;e-mail</div>
      <b>Votre carte étudiante n&apos;a pas été acceptée</b>
      <p>Bonjour {firstName},</p>
      <p>
        Notre équipe a examiné votre dossier mais n&apos;a pas pu valider votre carte étudiante pour la raison suivante :{" "}
        <b>{shownReason || "motif à choisir"}</b>
      </p>
      {note ? <p>{note}</p> : null}
      <p>Vous pouvez envoyer une nouvelle carte depuis votre profil.</p>
    </div>
  )
}

function RejectForm({ onClose, onConfirm, name }) {
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const sending = useRef(false)
  const cancelRef = useRef(null)
  const firstName = name.trim().split(/\s+/)[0] || "Étudiant"

  const submit = async () => {
    const problem = rejectFormError({ reason, message })
    if (problem) {
      setError({ field: errorField({ reason, message }, problem), text: problem })
      return
    }
    setPending(true)
    setError(null)
    const outcome = await confirmOnce(sending, () => onConfirm({ reason, message: message.trim() }))
    if (outcome.skipped) return
    setPending(false)
    if (outcome.error) {
      setError({ field: "reason", text: outcome.error })
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
      title={`Refuser la carte de ${name} ?`}
      icon={{ name: "i-x", tone: "erreur" }}
      description="L'étudiant recevra ce motif par e-mail et pourra renvoyer une carte."
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
            {pending ? "Envoi en cours" : "Refuser la carte"}
          </button>
        </>
      }
    >
      <div className="stack stack--3">
        <RejectFields
          reason={reason}
          message={message}
          error={error}
          onReason={(value) => {
            setReason(value)
            setError(null)
          }}
          onMessage={(value) => {
            setMessage(value)
            setError(null)
          }}
        />
        <Preview firstName={firstName} reason={reason} message={message} />
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
