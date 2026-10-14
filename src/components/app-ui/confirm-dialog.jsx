"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "./modal"
import { confirmStepView } from "./interactive-logic"

export const FALLBACK_ERROR = "Une erreur est survenue. Veuillez réessayer."

/**
 * Dernière étape, une seule fois à la fois : le verrou `guard` (`{ current }`, un useRef) est posé de façon
 * synchrone, donc un second clic avant le rendu suivant est ignoré. Libéré après une erreur (nouvelle tentative).
 * Renvoie { skipped } | { error } | { done }.
 */
export async function confirmOnce(guard, onConfirm) {
  if (guard.current) return { skipped: true }
  guard.current = true
  try {
    // onConfirm renvoie { error } pour un refus métier ; une exception est traitée comme une erreur.
    const result = await onConfirm()
    if (result?.error) {
      guard.current = false
      return { error: result.error }
    }
    return { done: true }
  } catch {
    guard.current = false
    return { error: FALLBACK_ERROR }
  }
}

/** Délai pendant lequel un clic de confirmation suivant le passage à l'étape 2 est tenu pour un double clic. */
export const STEP_SETTLE_MS = 300

/** Vrai tant que `now` est dans la fenêtre qui suit l'entrée à l'étape courante (`enteredAt` : null avant tout changement). */
export function isWithinSettle(now, enteredAt, delay = STEP_SETTLE_MS) {
  return enteredAt !== null && now - enteredAt < delay
}

// Vue pure : l'étape, l'envoi et l'erreur viennent de l'extérieur.
export function ConfirmDialogView({ steps, step, pending, error, tone, cancelLabel, onCancel, onConfirm, cancelRef }) {
  const current = steps[step]
  const { danger } = confirmStepView({ step, totalSteps: steps.length, tone })

  return (
    <Modal
      open
      onClose={onCancel}
      title={current.title}
      description={current.description}
      size="sm"
      tone={tone}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "btn btn--danger" : "btn btn--dark"}
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? "Envoi en cours" : current.confirmLabel}
          </button>
        </>
      }
    >
      {error ? (
        <div className="field__error" role="alert">
          <Icon name="i-alert-circle" />
          {error}
        </div>
      ) : null}
    </Modal>
  )
}

function ConfirmDialogOpen({ onClose, onConfirm, steps, tone, cancelLabel }) {
  const [step, setStep] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const cancelRef = useRef(null)
  const sending = useRef(false)
  const enteredAt = useRef(null)
  const { isLast } = confirmStepView({ step, totalSteps: steps.length, tone })

  // Au passage à l'étape 2, le bouton de confirmation a le focus : on le ramène sur « Annuler » (choix sûr).
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

  return (
    <ConfirmDialogView
      steps={steps}
      step={step}
      pending={pending}
      error={error}
      tone={tone}
      cancelLabel={cancelLabel}
      cancelRef={cancelRef}
      onCancel={() => {
        if (!pending) onClose()
      }}
      onConfirm={confirm}
    />
  )
}

// Confirmation en 1 ou 2 étapes. `steps` : [{ title, description, confirmLabel }] (1 ou 2 entrées).
// Le rouge plein n'apparaît qu'en tone="danger", à la dernière étape. Une erreur reste affichée sans fermer.
export function ConfirmDialog({ open, onClose, onConfirm, steps, tone = "default", cancelLabel = "Annuler" }) {
  if (!open) return null
  return (
    <ConfirmDialogOpen
      onClose={onClose}
      onConfirm={onConfirm}
      steps={steps}
      tone={tone}
      cancelLabel={cancelLabel}
    />
  )
}

export default ConfirmDialog
