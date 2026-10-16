"use client"

// @ds-screen RD-STUDENT-01
// Fenêtre « Signaler cette demande » (E07, T03). Adaptateur mince : le `ReportDialog` partagé de la messagerie fixe
// ses motifs (`REPORT_REASONS`), son titre et sa note dans le composant, sans propriété pour les remplacer, et il
// n'est pas modifié ici. Cette fenêtre en reprend donc les briques (Modal, RadioGroupField, TextareaField, envoi
// unique `submitReportOnce`, textes communs) avec les motifs d'achats de `@/lib/purchases/requests`. La validation du
// motif et de l'explication est celle du serveur (`reportPurchaseSchema`) : mêmes règles, mêmes messages.
//
// Contrat des props :
// - request : { id, seq, vendorName, amount, status } (résumé de la demande signalée) ;
// - onSubmit({ reason, details }) -> Promise<{ reference? } | { error }> ;
// - onClose().
import { useId, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { RadioGroupField, TextareaField } from "@/components/app-ui/fields"
import { submitReportOnce } from "@/components/messaging/report-dialog"
import {
  PURCHASE_NO_REFUND_NOTE,
  PURCHASE_REPORT_REASONS,
  REPORT_DETAILS_MAX,
  formatPurchaseAmount,
  reportPurchaseSchema,
  requestNumber,
  statusLabel,
} from "@/lib/purchases/requests"
import { ErrorBanner } from "./purchase-parts"

/** Messages d'erreur du motif et de l'explication, produits par le schéma du serveur. */
export function reportFieldErrors({ requestId, reason, details }) {
  const parsed = reportPurchaseSchema.safeParse({ requestId, reason, details })
  const errors = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if ((field === "reason" || field === "details") && !errors[field]) errors[field] = issue.message
    }
  }
  return errors
}

export function PurchaseReportDialog({ request, onSubmit, onClose }) {
  const uid = useId()
  const groupId = `${uid}-reason`
  const guard = useRef(false)
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [errors, setErrors] = useState({})
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
    const found = reportFieldErrors({ requestId: request.id, reason, details: details.trim() })
    if (found.reason || found.details) {
      setErrors(found)
      if (found.reason) document.getElementById(`${groupId}-${PURCHASE_REPORT_REASONS[0].value}`)?.focus()
      return
    }
    setErrors({})
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

  const summary = [request.vendorName, formatPurchaseAmount(request.amount), statusLabel(request.status)].filter(Boolean).join(" · ")

  return (
    <Modal
      open
      onClose={close}
      title="Signaler cette demande"
      description={`L'équipe EduCash examine le signalement. ${PURCHASE_NO_REFUND_NOTE}`}
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
      <div className="e2-07-form stack stack--3">
        <div className="e2-note">
          <Icon name="i-receipt" />
          <div className="e2-note__body">
            <div className="e2-note__title">Demande de paiement {requestNumber(request.seq)}</div>
            <div className="e2-note__text">{summary}</div>
          </div>
        </div>
        <RadioGroupField
          id={groupId}
          legend="Motif"
          name="purchase-report-reason"
          options={PURCHASE_REPORT_REASONS}
          value={reason}
          onChange={(value) => {
            setReason(value)
            setErrors((current) => ({ ...current, reason: undefined }))
          }}
          error={errors.reason}
          required
        />
        <TextareaField
          label="Ce qui s'est passé"
          required
          maxLength={REPORT_DETAILS_MAX}
          value={details}
          onChange={(e) => {
            setDetails(e.target.value)
            setErrors((current) => ({ ...current, details: undefined }))
          }}
          help="Restez factuel : dates, messages, montants. Seule l'équipe EduCash lit ce message."
          error={errors.details}
        />
        {error ? <ErrorBanner title="Signalement non envoyé">{error}</ErrorBanner> : null}
      </div>
    </Modal>
  )
}

export default PurchaseReportDialog
