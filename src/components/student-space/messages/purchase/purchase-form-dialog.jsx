"use client"

// @ds-screen RD-STUDENT-01
// Feuille « Demander un paiement d'achats » (E07, décision 24) : création et modification d'une demande en attente.
// Vue pure, non câblée (ST-10 la branche) : valeurs initiales en entrée, `onUploadPhoto` et `onSubmit` en sortie.
// L'étudiant n'avance jamais d'argent : la feuille le rappelle et annonce l'avertissement que verra le client.
//
// Contrat des props :
// - mode : "create" (défaut) ou "edit" ; seq : numéro d'ordre de la demande ; clientName : prénom ou nom du client ;
// - initialValues : { payeeKind, payeeNumber, vendorName, items, amount, payeePhoto, ticketPhoto } où une photo est
//   { path, previewUrl?, name? } (modification : les chemins et les adresses signées des preuves actuelles) ;
// - estimate / otherRequested : estimation d'achats de la mission et total des autres demandes non annulées, pour
//   l'avertissement non bloquant au-delà de 1,5 fois l'estimation ;
// - onUploadPhoto({ kind: "payee"|"ticket", file, extension }) -> Promise<{ path, previewUrl? } | { error }> ;
// - onSubmit({ payeeKind, payeeNumber, payeePhotoPath, vendorName, items, amount, ticketPhotoPath })
//   -> Promise<{ ok: true } | { error } | { fieldErrors: { [champ]: message } }> (succès : la feuille se ferme) ;
// - onClose().
import { useId, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { AmountField, TextField } from "@/components/app-ui/fields"
import {
  ITEMS_MAX,
  PAYEE_KINDS,
  PURCHASE_ESTIMATE_EXCEEDED_NOTE,
  PURCHASE_STUDENT_FORM_NOTE,
  PURCHASE_STUDENT_MONEY_NOTE,
  VENDOR_NAME_MAX,
  formatPayeeNumber,
  requestNumber,
} from "@/lib/purchases/requests"
import { validateProofFile } from "@/lib/purchases/proofs"
import { SEND_FALLBACK_ERROR, missingFields, runOnce, showsEstimateWarning, validateForm } from "./purchase-form-logic"
import { ErrorBanner, PhotoShot } from "./purchase-parts"

const cx = (...parts) => parts.filter(Boolean).join(" ")

const UPLOAD_FALLBACK_ERROR = "Photo non envoyée. Vérifiez votre connexion et réessayez."
const KIND_SHORT_LABELS = { merchant: "Numéro marchand", personal: "Numéro perso" }
const NUMBER_HELP = {
  merchant: "Le code marchand compte de 4 à 10 chiffres.",
  personal: "Numéro béninois de 10 chiffres commençant par 01.",
}
const PHOTO_COPY = {
  payee: {
    field: "payeePhoto",
    label: "Photo du numéro marchand MoMo ou du panneau",
    help: "Le panneau du vendeur avec son numéro, bien lisible.",
    icon: "i-smartphone",
  },
  ticket: {
    field: "ticketPhoto",
    label: "Photo du ticket ou des articles",
    help: "Le ticket de caisse, ou les articles posés avec le prix.",
    icon: "i-receipt",
    variant: "ticket",
  },
}

function startValues(initial) {
  return {
    payeeKind: initial?.payeeKind === "personal" ? "personal" : "merchant",
    payeeNumber: formatPayeeNumber(initial?.payeeNumber) || initial?.payeeNumber || "",
    vendorName: initial?.vendorName ?? "",
    items: initial?.items ?? "",
    amount: Number.isFinite(initial?.amount) ? initial.amount : null,
    payeePhoto: initial?.payeePhoto ?? null,
    ticketPhoto: initial?.ticketPhoto ?? null,
  }
}

export function PurchaseFormDialog({
  mode = "create",
  seq,
  clientName,
  initialValues,
  estimate,
  otherRequested = 0,
  onUploadPhoto,
  onSubmit,
  onClose,
}) {
  const uid = useId()
  const guard = useRef(false)
  const uploadTicket = useRef({ payee: 0, ticket: 0 })
  const [values, setValues] = useState(() => startValues(initialValues))
  const [touched, setTouched] = useState({})
  const [uploading, setUploading] = useState({})
  const [photoErrors, setPhotoErrors] = useState({})
  const [serverErrors, setServerErrors] = useState({})
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  const edit = mode === "edit"
  const busyUpload = Object.values(uploading).some(Boolean)
  const localErrors = validateForm(values).errors
  const shown = (field) => {
    if (serverErrors[field]) return serverErrors[field]
    if (photoErrors[field]) return photoErrors[field]
    return touched[field] ? (localErrors[field] ?? null) : null
  }

  const set = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    setServerErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
  }
  const touch = (field) => setTouched((current) => ({ ...current, [field]: true }))

  const close = () => {
    if (!pending) onClose()
  }

  async function pickPhoto(kind, file) {
    const { field } = PHOTO_COPY[kind]
    const check = validateProofFile(file)
    setPhotoErrors((current) => ({ ...current, [field]: check.ok ? undefined : check.error }))
    if (!check.ok) return
    const ticket = ++uploadTicket.current[kind]
    setUploading((current) => ({ ...current, [kind]: true }))
    let result
    try {
      result = await onUploadPhoto({ kind, file, extension: check.extension })
    } catch {
      result = { error: UPLOAD_FALLBACK_ERROR }
    }
    if (ticket !== uploadTicket.current[kind]) return
    setUploading((current) => ({ ...current, [kind]: false }))
    if (result?.error || !result?.path) {
      setPhotoErrors((current) => ({ ...current, [field]: result?.error || UPLOAD_FALLBACK_ERROR }))
      return
    }
    setPhotoErrors((current) => ({ ...current, [field]: undefined }))
    set(field, { path: result.path, previewUrl: result.previewUrl ?? null, name: file.name })
  }

  async function send() {
    if (guard.current) return
    const checked = validateForm(values)
    if (!checked.data) {
      setTouched(Object.fromEntries(Object.keys(checked.errors).map((field) => [field, true])))
      return
    }
    setPending(true)
    setError(null)
    const outcome = await runOnce(guard, () => onSubmit(checked.data), SEND_FALLBACK_ERROR)
    if (outcome.skipped) return
    if (outcome.error || outcome.fieldErrors) {
      setPending(false)
      setServerErrors(outcome.fieldErrors ?? {})
      setError(outcome.error ?? null)
      return
    }
    onClose()
  }

  const canSend = missingFields(values).length === 0 && !busyUpload && !pending
  const warn = showsEstimateWarning({ amount: values.amount, otherRequested, estimate })
  const number = requestNumber(seq)
  const description = [number, clientName].filter(Boolean).join(" · ")

  const photoShot = (kind) => {
    const copy = PHOTO_COPY[kind]
    return (
      <PhotoShot
        label={copy.label}
        placeholderTitle="Prendre une photo"
        placeholderHelp={copy.help}
        icon={copy.icon}
        thumbVariant={copy.variant}
        photo={values[copy.field]}
        uploading={uploading[kind]}
        error={shown(copy.field)}
        disabled={pending}
        onPick={(file) => pickPhoto(kind, file)}
      />
    )
  }

  return (
    <Modal
      open
      onClose={close}
      title={edit ? "Modifier la demande de paiement" : "Demander un paiement d'achats"}
      description={description || undefined}
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={close} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className={cx("btn btn--dark", pending && "is-loading")}
            onClick={send}
            disabled={!canSend}
            aria-busy={pending ? "true" : undefined}
          >
            <Icon name="i-send" />
            <span>{edit ? "Enregistrer les modifications" : "Envoyer la demande"}</span>
          </button>
        </>
      }
    >
      <div className="e2-07-form stack stack--3">
        <div className="e2-note">
          <Icon name="i-alert-triangle" />
          <div className="e2-note__body e2-note__text">{PURCHASE_STUDENT_FORM_NOTE}</div>
        </div>

        <div className="field">
          <span className="field__label" id={`${uid}-kind`}>
            Type de numéro
            <span className="req" aria-hidden="true">*</span>
          </span>
          <div className="segmented segmented--block" role="group" aria-labelledby={`${uid}-kind`}>
            {PAYEE_KINDS.map((kind) => (
              <button
                key={kind.value}
                type="button"
                className={cx("segmented__item", values.payeeKind === kind.value && "is-active")}
                aria-pressed={values.payeeKind === kind.value}
                onClick={() => set("payeeKind", kind.value)}
              >
                {KIND_SHORT_LABELS[kind.value]}
              </button>
            ))}
          </div>
        </div>

        {photoShot("payee")}

        <TextField
          label="Numéro à payer"
          required
          type="text"
          inputMode="tel"
          autoComplete="off"
          maxLength={24}
          value={values.payeeNumber}
          onChange={(e) => set("payeeNumber", e.target.value)}
          onBlur={() => touch("payeeNumber")}
          help={NUMBER_HELP[values.payeeKind]}
          error={shown("payeeNumber")}
        />

        <TextField
          label="Nom du vendeur"
          required
          type="text"
          autoComplete="off"
          maxLength={VENDOR_NAME_MAX}
          placeholder="Ex. Tantie Awa, Boutique Chez Codjo"
          value={values.vendorName}
          onChange={(e) => set("vendorName", e.target.value)}
          onBlur={() => touch("vendorName")}
          error={shown("vendorName")}
        />

        <AmountField
          label="Montant total"
          required
          value={values.amount}
          onChange={(next) => set("amount", next)}
          onBlur={() => touch("amount")}
          placeholder="0"
          help="Le montant exact à payer au vendeur, articles compris."
          error={shown("amount")}
        />
        {warn ? (
          <div className="e2-note" role="status">
            <Icon name="i-alert-triangle" />
            <div className="e2-note__body e2-note__text">{PURCHASE_ESTIMATE_EXCEEDED_NOTE}</div>
          </div>
        ) : null}

        {photoShot("ticket")}

        <TextField
          label="Articles"
          optional
          type="text"
          autoComplete="off"
          maxLength={ITEMS_MAX}
          placeholder="Ex. riz 25 kg, maïs 5 kg"
          value={values.items}
          onChange={(e) => set("items", e.target.value)}
          error={shown("items")}
        />

        <p className="caption">{PURCHASE_STUDENT_MONEY_NOTE}</p>

        {error ? <ErrorBanner title="La demande n'a pas été envoyée">{error}</ErrorBanner> : null}
      </div>
    </Modal>
  )
}

export default PurchaseFormDialog
