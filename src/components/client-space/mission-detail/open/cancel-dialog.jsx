"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { confirmOnce, isWithinSettle } from "@/components/app-ui/confirm-dialog"
import { formatAmount } from "@/lib/app/format"
import { joinNames, notifiedVerb } from "./names"

/**
 * Contenu des deux étapes de l'annulation (C07). `refundAmount` : montant réservé au grand livre (0 si inconnu ou
 * si les paiements sont en pause : le texte ne promet alors aucun montant et ne parle pas de séquestre).
 * `pendingNames` : prénoms des candidats en attente, qui sont prévenus par l'annulation.
 */
export function cancelSteps({ title, refundAmount, pendingNames = [] }) {
  const known = refundAmount > 0
  const notified = pendingNames.filter(Boolean)
  return [
    {
      title: "Annuler cette mission ?",
      icon: "i-x",
      consequences: [
        "La mission sort tout de suite des recherches",
        notified.length > 0
          ? `${joinNames(notified)} ${notifiedVerb(notified)} que la mission est annulée`
          : null,
        known ? `Les ${formatAmount(refundAmount)} reviennent sur votre portefeuille, en entier` : null,
      ].filter(Boolean),
      confirmLabel: "Continuer",
    },
    {
      title: "Confirmer l'annulation",
      icon: "i-alert-triangle",
      description: `C'est définitif : « ${title} » passe au statut Annulée et ne peut plus être rouverte. Vous pourrez la dupliquer plus tard.`,
      confirmLabel: known ? `Oui, annuler et rembourser ${formatAmount(refundAmount)}` : "Oui, annuler la mission",
    },
  ]
}

function RefundLines({ amount }) {
  return (
    <div className="lines2">
      <div className="lines2__row">
        <span>Montant remboursé</span>
        <b>{formatAmount(amount, { sign: "credit" })}</b>
      </div>
      <div className="lines2__row">
        <span>Vers</span>
        <b>Votre portefeuille EduCash</b>
      </div>
      <div className="lines2__row">
        <span>Délai</span>
        <b>Immédiat</b>
      </div>
    </div>
  )
}

/**
 * Vue pure des deux étapes (planche C07) : l'étape, l'envoi et l'erreur viennent de l'extérieur. Le rouge plein
 * n'apparaît qu'à la seconde étape, irréversible. Le motif de l'annulation de la planche n'est pas repris : aucune
 * donnée ne le conserve.
 */
export function CancelDialogView({ steps, step, refundAmount, subtitle, pending, error, onClose, onSecondary, onConfirm, cancelRef }) {
  const current = steps[step]
  const last = step === steps.length - 1
  return (
    <Modal
      open
      onClose={onClose}
      title={current.title}
      description={last ? `Étape ${step + 1} sur ${steps.length}` : subtitle}
      size={last ? "md" : "lg"}
      icon={{ name: current.icon }}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn--soft" onClick={onSecondary} disabled={pending}>
            {last ? "Retour" : "Garder la mission"}
          </button>
          <button
            type="button"
            className={last ? "btn btn--danger" : "btn btn--dark"}
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? (
              "Envoi en cours"
            ) : (
              <>
                {last ? null : <Icon name="i-arrow-right" />}
                {current.confirmLabel}
              </>
            )}
          </button>
        </>
      }
    >
      {last ? (
        <>
          <p className="status2__text">{current.description}</p>
          {refundAmount > 0 ? (
            <div className="lines2">
              <div className="lines2__row lines2__row--total">
                <span>Remboursé maintenant</span>
                <b>{formatAmount(refundAmount, { sign: "credit" })}</b>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="prof2__h">Ce qui va se passer</div>
          <ul className="checklist">
            {current.consequences.map((line) => (
              <li className="is-ok" key={line}>
                {line}
              </li>
            ))}
          </ul>
          {refundAmount > 0 ? (
            <>
              <div className="prof2__h">Remboursement</div>
              <RefundLines amount={refundAmount} />
            </>
          ) : null}
        </>
      )}
      {error ? (
        <div className="field__error" role="alert">
          <Icon name="i-alert-circle" />
          {error}
        </div>
      ) : null}
    </Modal>
  )
}

function CancelDialogOpen({ mission, refundAmount, pendingNames, applicationsCount, onClose, onConfirm }) {
  const [step, setStep] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const cancelRef = useRef(null)
  const sending = useRef(false)
  const enteredAt = useRef(null)
  const steps = cancelSteps({ title: mission.title, refundAmount, pendingNames })
  const isLast = step === steps.length - 1

  // Au passage à l'étape 2, le bouton de confirmation a le focus : on le ramène sur « Retour » (choix sûr).
  useEffect(() => {
    if (step > 0) cancelRef.current?.focus()
  }, [step])

  const confirm = async () => {
    if (isWithinSettle(Date.now(), enteredAt.current)) return
    if (!isLast) {
      enteredAt.current = Date.now()
      setStep(step + 1)
      return
    }
    if (sending.current) return
    setPending(true)
    setError(null)
    const outcome = await confirmOnce(sending, onConfirm)
    if (outcome.skipped) return
    setPending(false)
    if (outcome.error) {
      setError(outcome.error)
      return
    }
    onClose()
  }

  const close = () => {
    if (!pending) onClose()
  }
  // « Retour » ramène à l'étape 1 ; « Garder la mission » ferme.
  const secondary = () => {
    if (pending) return
    if (isLast) {
      setStep(step - 1)
      setError(null)
      return
    }
    onClose()
  }

  const subtitle =
    applicationsCount > 0 ? `${mission.title} · ${applicationsCount} candidature${applicationsCount > 1 ? "s" : ""}` : mission.title

  return (
    <CancelDialogView
      steps={steps}
      step={step}
      refundAmount={refundAmount}
      subtitle={subtitle}
      pending={pending}
      error={error}
      cancelRef={cancelRef}
      onClose={close}
      onSecondary={secondary}
      onConfirm={confirm}
    />
  )
}

/**
 * Annulation d'une mission ouverte, en deux étapes (la seconde, en rouge plein, est irréversible).
 * `onConfirm` renvoie `{ error }` pour un refus (affiché tel quel, la boîte reste ouverte). `refundAmount` vaut 0
 * tant que les paiements sont en pause ; `pendingNames` et `applicationsCount` décrivent les candidatures.
 */
export function CancelDialog({ open, mission, refundAmount = 0, pendingNames = [], applicationsCount = 0, onClose, onConfirm }) {
  if (!open) return null
  return (
    <CancelDialogOpen
      mission={mission}
      refundAmount={refundAmount}
      pendingNames={pendingNames}
      applicationsCount={applicationsCount}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}

export default CancelDialog
