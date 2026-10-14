"use client"

// @ds-screen RD-STUDENT-01
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
  maskLocalPhoneLastTwo,
} from "@/lib/client-space/withdraw-schema"

const ERR_UNEXPECTED = "Le retrait n'a pas pu être lancé."
const DEBIT_UNCERTAIN = "debit_uncertain"
const HELP_HREF = "/contact?sujet=question"

/**
 * Revalide le retrait puis l'envoie au serveur. Fonction pure à dépendance injectée (`initiate`).
 * @returns {Promise<{ kind: "invalid", errors: object } | { kind: "error", error: string, code?: string } | { kind: "done", value: object }>}
 */
export async function submitWithdrawal(input, available, initiate) {
  const checked = validateWithdraw(input, available)
  if (!checked.ok) return { kind: "invalid", errors: checked.errors }
  try {
    const result = await initiate(checked.value)
    return result?.error ? { kind: "error", error: result.error, code: result.code } : { kind: "done", value: checked.value }
  } catch {
    return { kind: "error", error: ERR_UNEXPECTED }
  }
}

/**
 * Verrou d'envoi : un second déclenchement (double clic, Entrée répétée) pendant qu'un envoi est en cours est
 * ignoré, avant même que le bouton soit désactivé par le rendu. Un retrait envoyé deux fois débiterait deux fois.
 */
export function createSendGuard() {
  let busy = false
  return {
    enter() {
      if (busy) return false
      busy = true
      return true
    },
    leave() {
      busy = false
    },
  }
}

const TITLES = {
  form: { title: "Retirer sur Mobile Money", description: "Vers ton compte Mobile Money, chez ton opérateur." },
  review: { title: "Vérifie avant d'envoyer", description: "Étape 2 sur 2" },
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

function FormStep({ available, amount, phone, operator, prefilled, errors, onAmount, onPhone, onOperator }) {
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
      {options.length > 0 ? (
        <div className="e2-09-chips">
          <ChipFilter label="Montants rapides" options={options} value={selectedAmount} onChange={(v) => onAmount(Number(v))} />
        </div>
      ) : null}
      <AmountField
        label="Montant"
        required
        value={amount}
        onChange={onAmount}
        error={errors.amount}
        help={`Disponible : ${formatAmount(available)} · minimum ${formatAmount(MIN_WITHDRAWAL_AMOUNT)}`}
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
          <span>{prefilled ? "Prérempli depuis ton profil. 10 chiffres, commence par 01." : "10 chiffres, commence par 01."}</span>
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

function ErrorBanner({ error, errorCode }) {
  if (!error) return null
  const uncertain = errorCode === DEBIT_UNCERTAIN
  return (
    <div className="banner banner--erreur" role="alert">
      <Icon name="i-alert-circle" />
      <div className="banner__body">
        <div className="banner__title">Le retrait n&apos;a pas pu être lancé</div>
        {error}
        {uncertain ? null : " Ton disponible a été actualisé : vérifie-le sur la page avant de réessayer."}
        <div className="banner__actions">
          <Link className="link2" href={HELP_HREF}>
            Contacter l&apos;aide
          </Link>
        </div>
      </div>
    </div>
  )
}

function ReviewStep({ available, amount, phone, operator, error, errorCode }) {
  return (
    <>
      <Stepper step="review" />
      <ErrorBanner error={error} errorCode={errorCode} />
      <p className="e2-09-sentence">
        Tu vas recevoir <b>{formatAmount(amount)}</b> sur le <b>{maskLocalPhoneLastTwo(phone)}</b>, {operatorLabel(operator)}.
      </p>
      <Lines rows={[{ label: "Montant du retrait", value: amount }]} />
      <Lines rows={[{ label: "Disponible après retrait", value: available - amount }]} />
      <ul className="checklist">
        <li className="is-ok">Le montant est débité de ton disponible dès l&apos;envoi de la demande.</li>
        <li className="is-ok">Si le virement ne part pas, contacte l&apos;aide avant de refaire une demande.</li>
      </ul>
    </>
  )
}

function DoneStep({ snapshot }) {
  return (
    <>
      <p className="e2-09-sentence">
        <b>{formatAmount(snapshot.amount)}</b> vont être virés sur le <b>{maskLocalPhoneLastTwo(snapshot.phone)}</b> ({operatorLabel(snapshot.operator)}) par notre prestataire de paiement agréé.
      </p>
      <Lines rows={[{ label: "Nouveau disponible", value: snapshot.availableAfter }]} />
      <p className="note2">
        <Icon name="i-info" />
        <span>Le délai d&apos;arrivée dépend de ton opérateur. Ton disponible est déjà mis à jour.</span>
      </p>
    </>
  )
}

/**
 * Vue pure de la modale de retrait (E09) : `step` vaut "form", "review" ou "done". L'état, l'envoi et les
 * erreurs viennent de l'extérieur.
 */
export function WithdrawDialogView({
  step, formId, contentRef, available, amount, phone, operator, prefilled, errors = {}, error, errorCode, pending, snapshot,
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
  } else if (step === "review" && error && errorCode === DEBIT_UNCERTAIN) {
    // Le portefeuille a peut-être été débité : ni « Réessayer » ni « Modifier », un nouvel envoi débiterait deux fois.
    footer = (
      <button type="button" className="btn btn--dark" onClick={onClose}>
        Fermer
      </button>
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
          available={available} amount={amount} phone={phone} operator={operator}
          prefilled={prefilled} errors={errors} onAmount={onAmount} onPhone={onPhone} onOperator={onOperator}
        />
      </form>
    )
  } else if (step === "review") {
    body = (
      <form id={formId} className="form2" onSubmit={onSubmit} noValidate>
        <ReviewStep available={available} amount={amount} phone={phone} operator={operator} error={error} errorCode={errorCode} />
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

function WithdrawDialogOpen({ available, phone: prefill, onClose }) {
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
  const [errorCode, setErrorCode] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [guard] = useState(createSendGuard)

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
      setErrorCode(null)
    }
  }

  function goReview(event) {
    event.preventDefault()
    setShowErrors(true)
    if (!checked.ok) return
    setError(null)
    setErrorCode(null)
    setStep("review")
  }

  async function send(event) {
    event.preventDefault()
    if (!guard.enter()) return
    setPending(true)
    setError(null)
    setErrorCode(null)
    const outcome = await submitWithdrawal({ amount, phone, operator }, available, initiateWithdrawal)
    guard.leave()
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
      setErrorCode(outcome.code ?? null)
      return
    }
    setSnapshot({
      amount: outcome.value.amount,
      phone: outcome.value.phone,
      operator: outcome.value.operator,
      availableAfter: available - outcome.value.amount,
    })
    setStep("done")
  }

  return (
    <WithdrawDialogView
      step={step}
      formId={formId}
      contentRef={contentRef}
      available={available}
      amount={amount}
      phone={phone}
      operator={operator}
      prefilled={Boolean(prefill)}
      errors={errors}
      error={error}
      errorCode={errorCode}
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
 * Modale de retrait (E09), en deux étapes puis un résultat. À ne rendre que si les paiements sont ouverts.
 * Le montant ne peut jamais dépasser le DISPONIBLE ; la validation d'ici est un simple confort d'usage, le serveur
 * (minimum et disponible) puis la fonction de paiement et le SQL font foi. `phone` (numéro complet) ne sert
 * qu'à préremplir le champ.
 * @param {{ open: boolean, onClose: () => void, available: number, phone?: string }} props
 */
export function WithdrawDialog({ open, onClose, available, phone = "" }) {
  if (!open) return null
  return <WithdrawDialogOpen available={available} phone={phone} onClose={onClose} />
}

export default WithdrawDialog
