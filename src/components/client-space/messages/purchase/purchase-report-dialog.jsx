"use client"

// Signalement d'une demande de paiement d'achats (maquette C13 v2.1, variante de T03). Le composant partagé
// `ReportDialog` (messagerie) fixe ses motifs, son titre « ce message » et une explication facultative : il ne
// peut pas porter les motifs d'achats ni l'explication obligatoire de 10 à 1 000 caractères. Cet adaptateur le
// double sans le modifier et réutilise ses briques (`submitReportOnce`, textes communs, `Modal`, champs).
// Vue pure : l'envoi est délégué à `onSubmit({ reason, details })` qui renvoie { reference } ou { error }.

import { useId, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { RadioGroupField, TextareaField } from "@/components/app-ui/fields"
import { REPORT_MISSING_REASON_COPY, submitReportOnce } from "@/components/messaging/report-dialog"
import {
  PURCHASE_NO_REFUND_NOTE,
  PURCHASE_REPORT_REASONS,
  REPORT_DETAILS_MAX,
  reportPurchaseSchema,
  requestNumber,
} from "@/lib/purchases/requests"
import { fieldIssues } from "./schema-issues"

export function PurchaseReportDialog({ request, onSubmit, onClose }) {
  const uid = useId()
  const groupId = `${uid}-reason`
  const guard = useRef(false)
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [reasonError, setReasonError] = useState(null)
  const [detailsError, setDetailsError] = useState(null)
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
        <p className="caption">{PURCHASE_NO_REFUND_NOTE}</p>
      </Modal>
    )
  }

  const send = async () => {
    if (guard.current) return
    if (!reason) {
      setReasonError(REPORT_MISSING_REASON_COPY)
      document.getElementById(`${groupId}-${PURCHASE_REPORT_REASONS[0].value}`)?.focus()
      return
    }
    const issues = fieldIssues(reportPurchaseSchema, { requestId: request.id, reason, details })
    if (issues.reason) {
      setReasonError(issues.reason)
      return
    }
    if (issues.details) {
      setDetailsError(issues.details)
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
      title="Signaler cette demande"
      description={`L'équipe examinera la demande ${requestNumber(request.seq)}${request.vendorName ? ` (${request.vendorName})` : ""}. L'autre partie sera informée du signalement.`}
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
          name="purchase-report-reason"
          options={PURCHASE_REPORT_REASONS}
          value={reason}
          onChange={(value) => {
            setReason(value)
            setReasonError(null)
          }}
          error={reasonError}
          required
        />
        <TextareaField
          label="Expliquez le problème"
          required
          maxLength={REPORT_DETAILS_MAX}
          value={details}
          onChange={(e) => {
            setDetails(e.target.value)
            setDetailsError(null)
          }}
          error={detailsError}
          help="Seule l'équipe EduCash lit ce message."
        />
        <p className="caption muted">{PURCHASE_NO_REFUND_NOTE}</p>
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

export default PurchaseReportDialog
