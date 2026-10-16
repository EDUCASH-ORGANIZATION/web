"use client"

// Fenêtre de signalement d'un message (maquette T03 v2.1). Vue pure : l'envoi est délégué à `onSubmit`
// ({ reason, details }) qui renvoie { reference } en cas de succès ou { error } sinon. Aucun accès aux données ici.
// Signaler n'est pas irréversible : bouton d'envoi en encre, pas de rouge plein. Aucun délai de réponse promis.

import { useId, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { RadioGroupField, TextareaField } from "@/components/app-ui/fields"
import { REPORT_DETAILS_MAX, REPORT_REASONS } from "@/lib/messaging/moderation-rules"

export const REPORT_MISSING_REASON_COPY = "Choisissez un motif."
export const REPORT_FALLBACK_ERROR = "Signalement non envoyé. Vérifiez votre connexion, votre texte est conservé."
export const REPORT_ANONYMOUS_COPY = "La personne ne saura pas qui a signalé."

/**
 * Envoi unique : le verrou `guard` ({ current }) est posé de façon synchrone, un second clic avant le rendu
 * suivant est ignoré. Libéré après une erreur. Renvoie { skipped } | { error } | { reference }.
 */
export async function submitReportOnce(guard, onSubmit, payload) {
  if (guard.current) return { skipped: true }
  guard.current = true
  try {
    const result = await onSubmit(payload)
    if (result?.error) {
      guard.current = false
      return { error: result.error }
    }
    return { reference: typeof result?.reference === "string" ? result.reference : null }
  } catch {
    guard.current = false
    return { error: REPORT_FALLBACK_ERROR }
  }
}

export function ReportDialog({ senderName, onSubmit, onClose }) {
  const uid = useId()
  const groupId = `${uid}-reason`
  const guard = useRef(false)
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [reasonError, setReasonError] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(null)

  const close = () => {
    if (!pending) onClose()
  }

  if (done) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Signalement envoyé"
        size="sm"
        icon={{ name: "i-check" }}
        footer={
          <button type="button" className="btn btn--dark" onClick={onClose}>
            Fermer
          </button>
        }
      >
        {done.reference ? (
          <p>
            Numéro de suivi <b className="a-ref">{done.reference}</b>
          </p>
        ) : null}
        <p className="caption">{REPORT_ANONYMOUS_COPY}</p>
      </Modal>
    )
  }

  const send = async () => {
    if (guard.current) return
    if (!reason) {
      setReasonError(REPORT_MISSING_REASON_COPY)
      document.getElementById(`${groupId}-${REPORT_REASONS[0].value}`)?.focus()
      return
    }
    setPending(true)
    setError(null)
    const outcome = await submitReportOnce(guard, onSubmit, { reason, details: details.trim() })
    if (outcome.skipped) return
    setPending(false)
    if (outcome.error) {
      setError(outcome.error)
      return
    }
    setDone({ reference: outcome.reference })
  }

  return (
    <Modal
      open
      onClose={close}
      title="Signaler un problème"
      description={`L'équipe examinera ce message${senderName ? ` de ${senderName}` : ""}${senderName?.endsWith(".") ? "" : "."} ${REPORT_ANONYMOUS_COPY}`}
      icon={{ name: "i-flag", tone: "erreur" }}
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={close} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className={pending ? "btn btn--dark is-loading" : "btn btn--dark"}
            onClick={send}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            <span>Envoyer le signalement</span>
          </button>
        </>
      }
    >
      <div className="stack">
        <RadioGroupField
          id={groupId}
          legend="Motif"
          name="report-reason"
          options={REPORT_REASONS}
          value={reason}
          onChange={(value) => {
            setReason(value)
            setReasonError(null)
          }}
          error={reasonError}
          required
        />
        <TextareaField
          label="Décrivez ce qui s'est passé"
          optional
          maxLength={REPORT_DETAILS_MAX}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          help="Seule l'équipe EduCash lit ce message."
        />
        {error ? (
          <div className="banner banner--erreur" role="alert">
            <Icon name="i-alert-triangle" />
            <div className="banner__body">
              <div className="banner__title">Signalement non envoyé</div>
              {error}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export default ReportDialog
