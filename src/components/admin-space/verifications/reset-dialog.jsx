// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { Modal } from "@/components/app-ui/modal"
import { TextareaField } from "@/components/app-ui/fields"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { REASON_MAX, REASON_MIN } from "@/lib/admin-space/decision-schemas"

/** Erreur de saisie d'un motif libre (5 à 500 caractères) ou chaîne vide. */
export function reasonError(reason) {
  const text = reason.replace(/\s+/g, " ").trim()
  return text.length < REASON_MIN ? `Le motif doit contenir au moins ${REASON_MIN} caractères.` : ""
}

const NO_PERSONAL_DATA = "N'indiquez pas de coordonnées personnelles."
export const VISIBLE_REASON_HELP = `Le motif est visible de l'étudiant. ${NO_PERSONAL_DATA}`
export const INTERNAL_REASON_HELP = NO_PERSONAL_DATA

/** Zone de motif : l'erreur est reliée à la zone de texte (aria-describedby, aria-invalid). `visible` : l'étudiant le lit. */
export function ReasonField({ reason, error, onChange, visible = false }) {
  return (
    <TextareaField
      label="Motif"
      help={visible ? VISIBLE_REASON_HELP : INTERNAL_REASON_HELP}
      required
      maxLength={REASON_MAX}
      value={reason}
      onChange={(e) => onChange(e.target.value)}
      error={error || undefined}
      rows={3}
    />
  )
}

function ReasonForm({ onClose, onConfirm, title, description, confirmLabel, tone, icon, consequences, visible }) {
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
      icon={icon}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn btn--danger" : "btn btn--primary a2-02-cta"}
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
        {consequences ? (
          <ul className="checklist">
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <ReasonField
          visible={visible}
          reason={reason}
          error={error}
          onChange={(value) => {
            setReason(value)
            setError("")
          }}
        />
      </div>
    </Modal>
  )
}

/** Boîte à motif obligatoire, commune à la réinitialisation d'un refus et à la révocation d'un badge. */
export function ReasonDialog({ open, onClose, onConfirm, title, description, confirmLabel, tone = "default", icon, consequences, visible = false }) {
  if (!open) return null
  return (
    <ReasonForm
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={tone}
      icon={icon}
      consequences={consequences}
      visible={visible}
    />
  )
}

const RESET_CONSEQUENCES = [
  "La carte refusée est retirée du dossier.",
  "L'étudiant peut renvoyer une carte.",
  "L'action est inscrite au journal d'audit avec votre motif.",
]

/** Réinitialisation d'un refus : l'étudiant pourra renvoyer une carte. Le motif de l'administrateur est journalisé. */
export function ResetDialog({ open, onClose, onConfirm, name }) {
  return (
    <ReasonDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Réinitialiser le dossier de ${name} ?`}
      icon={{ name: "i-refresh", tone: "lavande" }}
      consequences={RESET_CONSEQUENCES}
      description="Le motif de refus et la carte refusée sont retirés : le dossier passe en Incomplets et l'étudiant pourra renvoyer une carte. Indiquez pourquoi vous le faites."
      confirmLabel="Réinitialiser le refus"
    />
  )
}

export default ResetDialog
