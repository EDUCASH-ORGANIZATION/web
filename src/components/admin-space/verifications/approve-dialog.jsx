// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { formatDateFr } from "@/lib/app/format"

/**
 * Confirmation de validation : récapitulatif du badge (Vérifié, valable jusqu'au) puis « Valider et passer au suivant »
 * (ou « Valider la carte » quand le passage au dossier suivant est désactivé).
 * `onConfirm` renvoie `{ error }` en cas de refus (le message reste affiché, la boîte reste ouverte).
 * Pas de case « Prévenir par e-mail » : l'e-mail de décision part toujours.
 */
function ApproveBox({ onClose, onConfirm, name, badgeUntil, advance }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const sending = useRef(false)
  const until = formatDateFr(badgeUntil)

  const submit = async () => {
    setPending(true)
    setError("")
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
    <Modal
      open
      onClose={() => {
        if (!pending) onClose()
      }}
      title={`Valider la carte de ${name} ?`}
      description="L'étudiant en sera informé par e-mail."
      size="sm"
      icon={{ name: "i-check-circle", tone: "menthe" }}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--primary a2-02-cta"
            onClick={submit}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? "Envoi en cours" : advance ? "Valider et passer au suivant" : "Valider la carte"}
          </button>
        </>
      }
    >
      <div className="recap">
        <div className="recap__line">
          <span>Badge</span>
          <b>Vérifié</b>
        </div>
        <div className="recap__line">
          <span>Valable jusqu&apos;au</span>
          <b>{until}</b>
        </div>
      </div>
      {error ? (
        <div className="field__error" role="alert">
          <Icon name="i-alert-circle" />
          {error}
        </div>
      ) : null}
    </Modal>
  )
}

export function ApproveDialog({ open, onClose, onConfirm, name, badgeUntil, advance = true }) {
  if (!open) return null
  return <ApproveBox onClose={onClose} onConfirm={onConfirm} name={name} badgeUntil={badgeUntil} advance={advance} />
}

export default ApproveDialog
