"use client"

// Fenêtre « Payé » (maquette C13 v2.1) : le client a payé le vendeur directement par MoMo, hors EduCash, et le
// déclare. Capture du SMS obligatoire, case « bénéficiaire vérifié » obligatoire, référence facultative.
// Vue pure : le téléversement de la capture et l'écriture sont délégués à `onSubmit`. La version lue à l'ouverture
// accompagne l'envoi : si la demande change entre-temps (modifiée, annulée), la fenêtre se verrouille.

import { useId, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { CheckboxField, TextField } from "@/components/app-ui/fields"
import { validateProofFile } from "@/lib/purchases/proofs"
import {
  PAYEE_KINDS,
  PAYMENT_WARNING,
  PAID_REFERENCE_MAX,
  PURCHASE_BENEFICIARY_CHECK_LABEL,
  formatPayeeNumber,
  formatPurchaseAmount,
  markPaidSchema,
  requestNumber,
} from "@/lib/purchases/requests"
import { fieldIssues } from "./schema-issues"

export const PAID_FALLBACK_ERROR = "Le paiement n'a pas pu être enregistré. Vérifiez votre connexion : vos informations sont conservées."

const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"

// Le schéma de paiement ne valide qu'un chemin déjà téléversé : une valeur de remplacement non vide suffit ici
// pour n'en tirer que les messages de la case, de la référence et de la version.
const FILE_PLACEHOLDER = "capture"

// Message de version périmée du schéma de paiement (une seule source).
const VERSION_CHANGED_COPY = fieldIssues(markPaidSchema, { expectedVersion: 0 }).expectedVersion

function sizeText(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

/**
 * Envoi unique : le verrou `guard` ({ current }) est posé de façon synchrone, un second clic avant le rendu
 * suivant est ignoré. Libéré après une erreur. Renvoie { skipped } | { error, stale } | { done }.
 */
export async function submitPaidOnce(guard, onSubmit, payload) {
  if (guard.current) return { skipped: true }
  guard.current = true
  try {
    const result = await onSubmit(payload)
    if (result?.error) {
      guard.current = false
      return { error: result.error, stale: result.stale === true }
    }
    return { done: true }
  } catch {
    guard.current = false
    return { error: PAID_FALLBACK_ERROR, stale: false }
  }
}

/**
 * Fenêtre « Payé ».
 *
 * `request` : { id, seq, status, version, amount, vendorName, payeeKind, payeeNumber } ; `studentName` : prénom de
 * l'étudiant. `onSubmit({ requestId, expectedVersion, smsFile, paidReference, beneficiaryConfirmed })` renvoie
 * `{}` en cas de succès (la fenêtre se ferme alors par `onClose`) ou `{ error, stale? }` ; `stale: true` signale
 * une demande modifiée (la fenêtre se verrouille). `onClose()` ferme sans rien enregistrer.
 */
export function PaidDialog({ request, studentName, onSubmit, onClose }) {
  const uid = useId()
  const fileId = `${uid}-sms`
  const fileHelpId = `${uid}-sms-help`
  const fileErrorId = `${uid}-sms-error`
  const guard = useRef(false)
  const fileInput = useRef(null)
  // Version lue quand la fenêtre s'ouvre : c'est celle que le client a vue et qu'il déclare avoir payée.
  const [openedVersion] = useState(request.version)
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [reference, setReference] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(null)
  const [serverStale, setServerStale] = useState(null)
  const [pending, setPending] = useState(false)

  const stale = serverStale !== null || request.version !== openedVersion || request.status !== "pending"
  const issues = fieldIssues(markPaidSchema, {
    requestId: request.id,
    expectedVersion: openedVersion,
    smsPhotoPath: file ? FILE_PLACEHOLDER : "",
    beneficiaryConfirmed: confirmed,
    paidReference: reference,
  })
  const referenceError = reference.trim() === "" ? null : (issues.paidReference ?? null)
  const ready = Boolean(file) && confirmed && !referenceError && !stale && !pending

  const number = formatPayeeNumber(request.payeeNumber)
  const kind = PAYEE_KINDS.find((k) => k.value === request.payeeKind)
  const beneficiary = [request.vendorName, number].filter(Boolean).join(" · ")
  const who = studentName || "l'étudiant"

  const close = () => {
    if (!pending) onClose()
  }

  const pick = (event) => {
    const picked = event.target.files?.[0]
    event.target.value = ""
    if (!picked) return
    const verdict = validateProofFile(picked)
    if (!verdict.ok) {
      setFile(null)
      setFileError(verdict.error)
      return
    }
    setFileError(null)
    setFile(picked)
  }

  const send = async () => {
    if (!ready || guard.current) return
    setPending(true)
    setError(null)
    const outcome = await submitPaidOnce(guard, onSubmit, {
      requestId: request.id,
      expectedVersion: openedVersion,
      smsFile: file,
      paidReference: reference.trim() === "" ? null : reference.trim(),
      beneficiaryConfirmed: true,
    })
    if (outcome.skipped) return
    if (outcome.error) {
      setPending(false)
      if (outcome.stale) setServerStale(outcome.error)
      else setError(outcome.error)
      return
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={close}
      title={`Vous avez payé ${request.vendorName} ?`}
      description={`Demande de paiement d'achats ${requestNumber(request.seq)} · ${formatPurchaseAmount(request.amount)}`}
      icon={{ name: "i-receipt" }}
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={close} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className={pending ? "btn btn--dark is-loading" : "btn btn--dark"}
            onClick={send}
            disabled={!ready}
            aria-busy={pending ? "true" : undefined}
          >
            <Icon name="i-check" />
            <span>Marquer comme payé</span>
          </button>
        </>
      }
    >
      <div className="stack">
        {stale ? (
          <div className="banner banner--erreur" role="alert">
            <Icon name="i-alert-triangle" />
            <div className="banner__body">
              <div className="banner__title">Relisez la demande</div>
              {serverStale ?? VERSION_CHANGED_COPY}
            </div>
          </div>
        ) : null}

        <div className="c-payreq__warn" role="note">
          <Icon name="i-alert-triangle" className="ic ic--16" />
          <span>{PAYMENT_WARNING}</span>
        </div>

        <div className="lines2">
          <div className="lines2__row">
            <span>Montant demandé par {who}</span>
            <b>{formatPurchaseAmount(request.amount)}</b>
          </div>
          <div className="lines2__row">
            <span>Bénéficiaire</span>
            <b>{beneficiary}</b>
          </div>
          {kind ? (
            <div className="lines2__row">
              <span>Type de numéro</span>
              <b>{kind.label}</b>
            </div>
          ) : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={fileId}>
            Capture du SMS de confirmation
            <span className="req" aria-hidden="true">*</span>
          </label>
          {file ? (
            <div className="file file--ok">
              <span className="file__thumb">
                <Icon name="i-image" />
              </span>
              <div className="grow">
                <div className="file__name">{file.name}</div>
                <div className="file__meta">Ajoutée · {sizeText(file.size)}</div>
              </div>
              <button
                type="button"
                className="btn-icon btn-icon--sm"
                aria-label="Retirer la capture"
                onClick={() => setFile(null)}
                disabled={pending}
              >
                <Icon name="i-trash" />
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--soft btn--sm" onClick={() => fileInput.current?.click()} disabled={pending}>
              <Icon name="i-upload" />
              Choisir la capture
            </button>
          )}
          <input
            ref={fileInput}
            id={fileId}
            type="file"
            hidden
            accept={FILE_ACCEPT}
            onChange={pick}
            aria-required="true"
            aria-invalid={fileError ? "true" : undefined}
            aria-describedby={fileError ? `${fileHelpId} ${fileErrorId}` : fileHelpId}
          />
          <span id={fileHelpId} className="field__help">
            Le SMS de MoMo avec le montant, le nom du bénéficiaire et la référence. La capture sera visible de l&apos;étudiant (et de l&apos;équipe EduCash). Vous pouvez masquer votre solde avant de l&apos;envoyer.
          </span>
          {fileError ? (
            <div id={fileErrorId} className="field__error" role="alert">
              <Icon name="i-alert-circle" />
              {fileError}
            </div>
          ) : null}
        </div>

        <TextField
          label="Référence de la transaction"
          optional
          placeholder="Ex. 2610101122451"
          maxLength={PAID_REFERENCE_MAX}
          autoComplete="off"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          error={referenceError}
        />

        <CheckboxField
          label={PURCHASE_BENEFICIARY_CHECK_LABEL}
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          required
        />

        {error ? (
          <div className="banner banner--erreur" role="alert">
            <Icon name="i-alert-triangle" />
            <div className="banner__body">
              <div className="banner__title">Paiement non enregistré</div>
              {error}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export default PaidDialog
