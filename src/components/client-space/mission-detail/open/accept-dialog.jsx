"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { Lines } from "@/components/app-ui/lines"
import { Modal } from "@/components/app-ui/modal"
import { formatAmount } from "@/lib/app/format"
import { studentFirstName, studentName, studentSubtitle, VerificationBadge } from "./candidate-row"

const FALLBACK_ERROR = "Une erreur est survenue. Veuillez réessayer."

/**
 * Vue pure de la modale d'acceptation : l'envoi et l'erreur viennent de l'extérieur.
 * `applicant` : { student } (candidature ou profil du tiroir) ; `split` : escrowSplit(budget).
 */
export function AcceptDialogView({ applicant, mission, split, pending, error, onCancel, onConfirm, cancelRef }) {
  const { student } = applicant
  const name = studentName(student)
  const first = studentFirstName(student)
  return (
    <Modal
      open
      onClose={onCancel}
      title={first ? `Retenir ${first} pour cette mission ?` : "Retenir ce candidat pour cette mission ?"}
      description={mission.title}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onCancel} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--dark"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? (
              "Envoi en cours"
            ) : (
              <>
                <Icon name="i-check" />
                {first ? `Accepter ${first}` : "Accepter"}
              </>
            )}
          </button>
        </>
      }
    >
      <div className="person2">
        <Avatar name={name} src={student.avatarUrl} />
        <div className="cand2__who">
          <div className="person2__name">
            {name}
            <VerificationBadge student={student} />
          </div>
          {studentSubtitle(student) ? <div className="person2__sub">{studentSubtitle(student)}</div> : null}
        </div>
      </div>
      <ul className="checklist">
        <li className="is-ok">Les autres candidatures seront refusées et la mission passera en cours</li>
        <li className="is-ok">Les {formatAmount(mission.budget)} restent en séquestre : rien de plus à payer</li>
      </ul>
      <Lines total={{ label: `Versé à ${first || "l'étudiant"} après votre validation`, value: split.student }} />
      {error ? (
        <div className="field__error" role="alert">
          <Icon name="i-alert-circle" />
          {error}
        </div>
      ) : null}
    </Modal>
  )
}

/**
 * Envoi unique : `guard` ({ current }) est une garde synchrone, un double clic n'appelle `onConfirm` qu'une fois
 * (l'état React ne se met à jour qu'au rendu suivant). La garde est rendue après un refus ou une exception,
 * pour permettre une nouvelle tentative. Renvoie { skipped } | { error } | { done }.
 */
export async function submitOnce(guard, onConfirm) {
  if (guard.current) return { skipped: true }
  guard.current = true
  try {
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

function AcceptDialogOpen({ applicant, mission, split, onClose, onConfirm }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const cancelRef = useRef(null)
  const sending = useRef(false)

  const confirm = async () => {
    if (sending.current) return
    setPending(true)
    setError(null)
    const outcome = await submitOnce(sending, onConfirm)
    if (outcome.error) {
      setError(outcome.error)
      setPending(false)
      return
    }
    onClose()
  }

  return (
    <AcceptDialogView
      applicant={applicant}
      mission={mission}
      split={split}
      pending={pending}
      error={error}
      cancelRef={cancelRef}
      onCancel={() => {
        if (!pending) onClose()
      }}
      onConfirm={confirm}
    />
  )
}

/**
 * Modale d'acceptation (C04). `onConfirm` renvoie `{ error }` pour un refus métier (affiché tel quel, la
 * boîte reste ouverte) ; un succès ferme la boîte. Fermée, rien n'est rendu (l'état repart de zéro).
 */
export function AcceptDialog({ open, applicant, mission, split, onClose, onConfirm }) {
  if (!open || !applicant) return null
  return <AcceptDialogOpen applicant={applicant} mission={mission} split={split} onClose={onClose} onConfirm={onConfirm} />
}

export default AcceptDialog
