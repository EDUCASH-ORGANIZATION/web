"use client"

import { useId, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { AmountField } from "@/components/app-ui/fields"
import { ChipFilter } from "@/components/app-ui/chip-filter"
import { Lines } from "@/components/app-ui/lines"
import { formatAmountInput } from "@/components/app-ui/interactive-logic"
import { formatAmount } from "@/lib/app/format"
import { initiateDeposit } from "@/lib/actions/wallet.actions"
import { MIN_DEPOSIT_AMOUNT } from "@/lib/supabase/database.constants"
import { QUICK_DEPOSIT_AMOUNTS, depositAmountError, safePaymentUrl } from "@/lib/client-space/deposit-return"

const ERR_REDIRECT = "L'adresse de paiement reçue n'est pas valide. Votre portefeuille n'a pas été modifié, réessayez dans un instant."
const ERR_UNEXPECTED = "Le paiement n'a pas pu être lancé. Votre portefeuille n'a pas été modifié, réessayez dans un instant."

/**
 * Valide le montant puis demande l'adresse de paiement au serveur. Fonction pure à dépendance injectée
 * (`initiate`) : elle ne touche ni la page ni l'état.
 * @param {number|null} amount
 * @param {(input: { amount: number }) => Promise<{ error?: string, paymentUrl?: string }>} initiate
 * @returns {Promise<{ kind: "invalid", amountError: string } | { kind: "error", error: string } | { kind: "redirect", url: string }>}
 */
export async function submitDeposit(amount, initiate) {
  const amountError = depositAmountError(amount)
  if (amountError) return { kind: "invalid", amountError }
  try {
    const result = await initiate({ amount })
    if (result?.error) return { kind: "error", error: result.error }
    const url = safePaymentUrl(result?.paymentUrl)
    return url ? { kind: "redirect", url } : { kind: "error", error: ERR_REDIRECT }
  } catch {
    return { kind: "error", error: ERR_UNEXPECTED }
  }
}

// Montants proposés : la suggestion (montant manquant venu de la publication) en premier, puis les montants rapides.
function quickOptions(suggestion) {
  const options = QUICK_DEPOSIT_AMOUNTS.map((n) => ({ value: String(n), label: formatAmountInput(n) }))
  if (suggestion && !QUICK_DEPOSIT_AMOUNTS.includes(suggestion)) {
    options.unshift({ value: String(suggestion), label: `${formatAmountInput(suggestion)} · montant suggéré` })
  }
  return options
}

/**
 * Vue pure de la modale de recharge (C15). L'état, l'envoi et l'erreur viennent de l'extérieur.
 * `error` est le message d'un refus du serveur ; `amountError` celui du champ montant.
 */
export function DepositDialogView({ amount, available, suggestion, pending, error, amountError, onAmount, onSubmit, onClose, formId }) {
  const value = amount ?? 0
  const options = quickOptions(suggestion)
  const selected = options.some((o) => o.value === String(amount)) ? String(amount) : ""
  return (
    <Modal
      open
      onClose={onClose}
      title="Recharger mon portefeuille"
      description="Paiement sécurisé par Mobile Money"
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button type="submit" form={formId} className="btn btn--dark" disabled={pending} aria-busy={pending ? "true" : undefined}>
            {pending ? "Redirection en cours" : "Continuer vers le paiement"}
            {pending ? null : <Icon name="i-external" />}
          </button>
        </>
      }
    >
      <form id={formId} className="form2 dialog2__content" onSubmit={onSubmit} noValidate>
        {suggestion ? (
          <div className="banner banner--info" role="status">
            <Icon name="i-info" />
            <div className="banner__body">
              Montant suggéré pour publier votre mission : {formatAmount(suggestion)}. Vous pouvez le modifier.
            </div>
          </div>
        ) : null}
        <div className="amount-chips2">
          <ChipFilter label="Montants rapides" options={options} value={selected} onChange={(v) => onAmount(Number(v))} />
        </div>
        <AmountField
          label="Montant à recharger"
          required
          value={amount}
          onChange={onAmount}
          error={amountError}
          help={`Minimum ${formatAmount(MIN_DEPOSIT_AMOUNT)}. Les espaces s'ajoutent tout seuls.`}
        />
        <Lines
          rows={[{ label: "Montant de la recharge", value: value }]}
          total={{ label: "Disponible après recharge", value: available + value }}
        />
        <p className="note2 note2--box">
          <Icon name="i-lock" />
          <span>
            Vous serez redirigé vers notre <b>prestataire de paiement agréé</b>, où vous choisirez votre opérateur Mobile Money et validerez le paiement de façon sécurisée.
          </span>
        </p>
        {error ? (
          <div className="banner banner--erreur" role="alert">
            <Icon name="i-alert-circle" />
            <div className="banner__body">{error}</div>
          </div>
        ) : null}
      </form>
    </Modal>
  )
}

function DepositDialogOpen({ available, suggestion, onClose }) {
  const formId = useId()
  const [amount, setAmount] = useState(suggestion ?? null)
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const inFlight = useRef(false)

  const amountError = touched ? depositAmountError(amount) : null

  async function submit(event) {
    event.preventDefault()
    if (inFlight.current) return
    setTouched(true)
    setError(null)
    inFlight.current = true
    setPending(true)
    const outcome = await submitDeposit(amount, initiateDeposit)
    if (outcome.kind === "redirect") {
      // Le bouton reste inactif pendant la redirection : aucun second paiement possible.
      window.location.assign(outcome.url)
      return
    }
    if (outcome.kind === "error") setError(outcome.error)
    inFlight.current = false
    setPending(false)
  }

  return (
    <DepositDialogView
      formId={formId}
      amount={amount}
      available={available}
      suggestion={suggestion}
      pending={pending}
      error={error}
      amountError={amountError}
      onAmount={(next) => {
        setAmount(next)
        setError(null)
      }}
      onSubmit={submit}
      onClose={() => {
        if (!pending) onClose()
      }}
    />
  )
}

/**
 * Modale de recharge (C15). À ne rendre que si les paiements sont ouverts (`paymentsEnabled()` côté serveur).
 * Aucun montant n'est crédité ici : le paiement se fait chez le prestataire, le serveur crédite le portefeuille.
 * @param {{ open: boolean, onClose: () => void, available: number, suggestion?: number|null }} props
 */
export function DepositDialog({ open, onClose, available, suggestion = null }) {
  if (!open) return null
  return <DepositDialogOpen available={available} suggestion={suggestion} onClose={onClose} />
}

export default DepositDialog
