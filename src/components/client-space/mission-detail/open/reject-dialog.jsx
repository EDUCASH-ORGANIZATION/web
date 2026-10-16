"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { studentFirstName } from "./candidate-row"

/**
 * Vue pure du refus (planche C04) : l'envoi et l'erreur viennent de l'extérieur. Pas de motif ni d'annulation
 * différée : aucune donnée ne conserve le motif et le refus est définitif.
 */
export function RejectDialogView({ first, missionTitle, pending, error, onCancel, onConfirm, cancelRef }) {
  return (
    <Modal
      open
      onClose={onCancel}
      title={first ? `Refuser la candidature de ${first} ?` : "Refuser cette candidature ?"}
      description={missionTitle}
      icon={{ name: "i-x" }}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn--soft" onClick={onCancel} disabled={pending}>
            Garder
          </button>
          <button
            type="button"
            className="btn btn--dark"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? "Envoi en cours" : "Refuser"}
          </button>
        </>
      }
    >
      <p className="status2__text">
        {`${first || "Le candidat"} sera prévenu que sa candidature n'est pas retenue. Cette décision est définitive.`}
      </p>
      {error ? (
        <div className="field__error" role="alert">
          <Icon name="i-alert-circle" />
          {error}
        </div>
      ) : null}
    </Modal>
  )
}

function RejectDialogOpen({ applicant, mission, onClose, onConfirm }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const cancelRef = useRef(null)
  const sending = useRef(false)

  const confirm = async () => {
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
    <RejectDialogView
      first={studentFirstName(applicant.student)}
      missionTitle={mission.title}
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
 * Refus d'une candidature (C04, C05) : une seule confirmation. `onConfirm` renvoie `{ error }` pour un refus
 * métier (affiché tel quel dans la boîte, qui reste ouverte).
 */
export function RejectDialog({ open, applicant, mission, onClose, onConfirm }) {
  if (!open || !applicant) return null
  return <RejectDialogOpen applicant={applicant} mission={mission} onClose={onClose} onConfirm={onConfirm} />
}

export default RejectDialog
