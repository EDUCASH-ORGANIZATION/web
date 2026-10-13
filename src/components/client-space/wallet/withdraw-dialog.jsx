"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { AmountField } from "@/components/app-ui/fields"
import { ChipFilter } from "@/components/app-ui/chip-filter"
import { Lines } from "@/components/app-ui/lines"
import { formatAmountInput } from "@/components/app-ui/interactive-logic"
import { OperatorLogo } from "@/components/vitrine/shared/operator-logo"
import { formatAmount } from "@/lib/app/format"
import { initiateWithdrawal } from "@/lib/actions/wallet.actions"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"
import {
  WITHDRAW_OPERATORS,
  operatorLabel,
  validateWithdraw,
  withdrawQuickAmounts,
  maskLocalPhone,
} from "@/lib/client-space/withdraw-schema"

const ERR_UNEXPECTED = "Le retrait n'a pas pu être lancé."

/**
 * Revalide le retrait puis l'envoie au serveur. Fonction pure à dépendance injectée (`initiate`).
 * @returns {Promise<{ kind: "invalid", errors: object } | { kind: "error", error: string } | { kind: "done", value: object }>}
 */
export async function submitWithdrawal(input, available, initiate) {
  const checked = validateWithdraw(input, available)
  if (!checked.ok) return { kind: "invalid", errors: checked.errors }
  try {
    const result = await initiate(checked.value)
    return result?.error ? { kind: "error", error: result.error } : { kind: "done", value: checked.value }
  } catch {
    return { kind: "error", error: ERR_UNEXPECTED }
  }
}

const TITLES = {
  form: { title: "Retirer sur Mobile Money", description: "Seul votre disponible peut être retiré" },
  review: { title: "Vérifiez avant d'envoyer", description: "Étape 2 sur 2" },
  done: { title: "Demande de retrait envoyée", description: undefined },
}

function Stepper({ step }) {
  const onForm = step === "form"
  return (
    <div className="stepper stepper--compact" role="group" aria-label={`Étape ${onForm ? 1 : 2} sur 2`}>
      <div className={onForm ? "step is-current" : "step is-done"}>
        <span className="step__dot">{onForm ? "1" : <Icon name="i-check" />}</span>
        <span className="step__label">Montant et numéro</span>
      </div>
      <span className={onForm ? "step__line" : "step__line is-done"} />
      <div className={onForm ? "step" : "step is-current"}>
        <span className="step__dot">2</span>
        <span className="step__label">Récapitulatif</span>
      </div>
    </div>
  )
}

function FormStep({ available, escrow, amount, phone, operator, prefilled, errors, onAmount, onPhone, onOperator }) {
  const uid = useId()
  const phoneId = `${uid}-phone`
  const phoneHelpId = `${uid}-phone-help`
  const phoneErrorId = `${uid}-phone-error`
  const quick = withdrawQuickAmounts(available)
  const options = quick.map((q) => ({
    value: String(q.value),
    label: q.all ? `Tout retirer · ${formatAmountInput(q.value)}` : formatAmountInput(q.value),
  }))
  const selectedAmount = options.some((o) => o.value === String(amount)) ? String(amount) : ""
  const operators = WITHDRAW_OPERATORS.map((o) => ({
    value: o.value,
    label: (
      <span className="payer">
        <OperatorLogo operator={o.value} />
        {o.label}
      </span>
    ),
  }))
  const describedBy = [phoneHelpId, errors.phone ? phoneErrorId : null].filter(Boolean).join(" ")
  return (
    <>
      <Stepper step="form" />
      <p className="note2 note2--box">
        <Icon name="i-lock" />
        <span>
          Disponible : <b>{formatAmount(available)}</b>. Les {formatAmount(escrow)} en séquestre ne peuvent pas être retirés : ils sont réservés à vos missions.
        </span>
      </p>
      {options.length > 0 ? (
        <div className="amount-chips2">
          <ChipFilter label="Montants rapides" options={options} value={selectedAmount} onChange={(v) => onAmount(Number(v))} />
        </div>
      ) : null}
      <AmountField
        label="Montant à retirer"
        required
        value={amount}
        onChange={onAmount}
        error={errors.amount}
        help={`Minimum ${formatAmount(MIN_WITHDRAWAL_AMOUNT)} · maximum ${formatAmount(available)}`}
      />
      <div className="field">
        <label className="field__label" htmlFor={phoneId}>
          Numéro Mobile Money
          <span className="req" aria-hidden="true">*</span>
        </label>
        <div className={errors.phone ? "control is-error" : "control"}>
          <span className="control__prefix">+229</span>
          <input
            id={phoneId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            aria-invalid={errors.phone ? "true" : undefined}
            aria-describedby={describedBy}
          />
        </div>
        <div id={phoneHelpId} className="field__help">
          <span>{prefilled ? "Prérempli depuis votre profil. 10 chiffres, commence par 01." : "10 chiffres, commence par 01."}</span>
        </div>
        {errors.phone ? (
          <div id={phoneErrorId} className="field__error" role="alert">
            <Icon name="i-alert-circle" />
            {errors.phone}
          </div>
        ) : null}
      </div>
      <div className="field">
        <span className="field__label">
          Opérateur
          <span className="req" aria-hidden="true">*</span>
        </span>
        <ChipFilter label="Opérateur" options={operators} value={operator ?? ""} onChange={onOperator} />
        {errors.operator ? (
          <div className="field__error" role="alert">
            <Icon name="i-alert-circle" />
            {errors.operator}
          </div>
        ) : null}
      </div>
    </>
  )
}

function ReviewStep({ available, escrow, amount, phone, operator, error }) {
  return (
    <>
      <Stepper step="review" />
      {error ? (
        <div className="banner banner--erreur" role="alert">
          <Icon name="i-alert-circle" />
          <div className="banner__body">
            <div className="banner__title">Le retrait n&apos;a pas pu être lancé</div>
            {error} Votre disponible a été actualisé : vérifiez-le sur la page avant de réessayer.
            <div className="banner__actions">
              <Link className="link2" href="/contact?sujet=question">
                Contacter l&apos;aide
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      <p className="lead2">
        Vous allez recevoir <b>{formatAmount(amount)}</b> sur le <b>{maskLocalPhone(phone)}</b>, {operatorLabel(operator)}.
      </p>
      <Lines rows={[{ label: "Montant du retrait", value: amount }]} />
      <Lines
        rows={[
          { label: "Disponible après retrait", value: available - amount },
          { label: "En séquestre, inchangé", value: escrow },
        ]}
      />
      <ul className="checklist">
        <li className="is-ok">Le montant est débité de votre disponible dès l&apos;envoi de la demande.</li>
        <li className="is-ok">Les fonds en séquestre ne peuvent pas être retirés.</li>
      </ul>
    </>
  )
}

function DoneStep({ snapshot }) {
  return (
    <>
      <p className="lead2">
        <b>{formatAmount(snapshot.amount)}</b> vont être virés sur le <b>{maskLocalPhone(snapshot.phone)}</b> ({operatorLabel(snapshot.operator)}) par notre prestataire de paiement agréé.
      </p>
      <Lines
        rows={[
          { label: "Nouveau disponible", value: snapshot.availableAfter },
          { label: "En séquestre", value: snapshot.escrow },
        ]}
      />
      <p className="note2">
        <Icon name="i-info" />
        <span>Le délai d&apos;arrivée dépend de votre opérateur. Votre disponible est déjà mis à jour.</span>
      </p>
    </>
  )
}

/**
 * Vue pure de la modale de retrait (C16) : `step` vaut "form", "review" ou "done". L'état, l'envoi et les
 * erreurs viennent de l'extérieur.
 */
export function WithdrawDialogView({
  step, formId, contentRef, available, escrow, amount, phone, operator, prefilled, errors = {}, error, pending, snapshot,
  onAmount, onPhone, onOperator, onContinue, onBack, onSubmit, onClose,
}) {
  const head = TITLES[step]
  let footer
  if (step === "form") {
    footer = (
      <>
        <button type="button" className="btn btn--soft" onClick={onClose}>
          Annuler
        </button>
        <button type="submit" form={formId} className="btn btn--dark">
          Continuer
          <Icon name="i-arrow-right" />
        </button>
      </>
    )
  } else if (step === "review") {
    footer = (
      <>
        <button type="button" className="btn btn--soft" onClick={onBack} disabled={pending}>
          <Icon name="i-arrow-left" />
          Modifier
        </button>
        <button type="submit" form={formId} className="btn btn--dark" disabled={pending} aria-busy={pending ? "true" : undefined}>
          {pending ? "Envoi en cours" : error ? "Réessayer" : `Retirer ${formatAmount(amount)}`}
        </button>
      </>
    )
  } else {
    footer = (
      <button type="button" className="btn btn--dark" onClick={onClose}>
        Fermer
      </button>
    )
  }

  let body
  if (step === "form") {
    body = (
      <form id={formId} className="form2" onSubmit={onContinue} noValidate>
        <FormStep
          available={available} escrow={escrow} amount={amount} phone={phone} operator={operator}
          prefilled={prefilled} errors={errors} onAmount={onAmount} onPhone={onPhone} onOperator={onOperator}
        />
      </form>
    )
  } else if (step === "review") {
    body = (
      <form id={formId} className="form2" onSubmit={onSubmit} noValidate>
        <ReviewStep available={available} escrow={escrow} amount={amount} phone={phone} operator={operator} error={error} />
      </form>
    )
  } else {
    body = (
      <div className="form2">
        <DoneStep snapshot={snapshot} />
      </div>
    )
  }

  return (
    <Modal open onClose={onClose} title={head.title} description={head.description} footer={footer}>
      <div ref={contentRef} tabIndex={-1} className="dialog2__content">
        {body}
      </div>
    </Modal>
  )
}

function WithdrawDialogOpen({ available, escrow, phone: prefill, onClose }) {
  const router = useRouter()
  const formId = useId()
  const contentRef = useRef(null)
  const [step, setStep] = useState("form")
  const [amount, setAmount] = useState(null)
  const [phone, setPhone] = useState(prefill ?? "")
  const [operator, setOperator] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const inFlight = useRef(false)

  // Au changement d'étape, le bouton pressé disparaît : le focus revient sur le contenu de la modale.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    contentRef.current?.focus()
  }, [step])

  const checked = validateWithdraw({ amount, phone, operator }, available)
  const errors = showErrors && !checked.ok ? checked.errors : {}

  function reset(update) {
    return (value) => {
      update(value)
      setError(null)
    }
  }

  function goReview(event) {
    event.preventDefault()
    setShowErrors(true)
    if (!checked.ok) return
    setError(null)
    setStep("review")
  }

  async function send(event) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    const outcome = await submitWithdrawal({ amount, phone, operator }, available, initiateWithdrawal)
    inFlight.current = false
    setPending(false)
    if (outcome.kind === "invalid") {
      // Le disponible a changé depuis le récapitulatif : retour au formulaire avec les erreurs.
      setShowErrors(true)
      setStep("form")
      return
    }
    // Dans tous les cas la page se rafraîchit : le solde affiché reste celui du serveur.
    router.refresh()
    if (outcome.kind === "error") {
      setError(outcome.error)
      return
    }
    setSnapshot({
      amount: outcome.value.amount,
      phone: outcome.value.phone,
      operator: outcome.value.operator,
      availableAfter: available - outcome.value.amount,
      escrow,
    })
    setStep("done")
  }

  return (
    <WithdrawDialogView
      step={step}
      formId={formId}
      contentRef={contentRef}
      available={available}
      escrow={escrow}
      amount={amount}
      phone={phone}
      operator={operator}
      prefilled={Boolean(prefill)}
      errors={errors}
      error={error}
      pending={pending}
      snapshot={snapshot}
      onAmount={reset(setAmount)}
      onPhone={reset(setPhone)}
      onOperator={reset(setOperator)}
      onContinue={goReview}
      onBack={() => setStep("form")}
      onSubmit={send}
      onClose={() => {
        if (!pending) onClose()
      }}
    />
  )
}

/**
 * Modale de retrait (C16), en deux étapes puis un résultat. À ne rendre que si les paiements sont ouverts.
 * Le montant ne peut jamais dépasser le DISPONIBLE (séquestre exclu) ; le serveur revalide tout.
 * @param {{ open: boolean, onClose: () => void, available: number, escrow: number, phone?: string }} props
 */
export function WithdrawDialog({ open, onClose, available, escrow, phone = "" }) {
  if (!open) return null
  return <WithdrawDialogOpen available={available} escrow={escrow} phone={phone} onClose={onClose} />
}

export default WithdrawDialog
