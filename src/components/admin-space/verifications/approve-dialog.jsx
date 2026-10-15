// @ds-screen RD-ADMIN-01
"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { confirmOnce } from "@/components/app-ui/confirm-dialog"
import { formatDateFr } from "@/lib/app/format"

/**
 * Confirmation de validation (planche v1) : sous-titre « niveau · école » (`caption`, quand il est connu), récapitulatif
 * du badge (Vérifié, valable jusqu'au, « (1 an) » : voir `badgeUntil`) puis « Valider et passer au suivant » (ou
 * « Valider la carte » quand le passage au dossier suivant est désactivé). Le focus initial va sur « Annuler ».
 * `onConfirm` renvoie `{ error }` en cas de refus (le message reste affiché, la boîte reste ouverte).
 * Écarts assumés avec la planche : pas de case « Prévenir par e-mail » (l'e-mail de décision part toujours, ce que
 * rappelle une ligne sous le récapitulatif) ni de ligne « Renouvellement proposé » (aucune règle métier ne la fixe).
 */
function ApproveBox({ onClose, onConfirm, name, caption, badgeUntil, advance }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const sending = useRef(false)
  const cancelRef = useRef(null)
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
      description={caption || undefined}
      size="sm"
      icon={{ name: "i-check-circle", tone: "menthe" }}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onClose} disabled={pending}>
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
          <b>{until} (1 an)</b>
        </div>
      </div>
      <p className="caption">L&apos;étudiant en sera informé par e-mail.</p>
      {error ? (
        <div className="field__error" role="alert">
          <Icon name="i-alert-circle" />
          {error}
        </div>
      ) : null}
    </Modal>
  )
}

export function ApproveDialog({ open, onClose, onConfirm, name, caption = "", badgeUntil, advance = true }) {
  if (!open) return null
  return <ApproveBox onClose={onClose} onConfirm={onConfirm} name={name} caption={caption} badgeUntil={badgeUntil} advance={advance} />
}

export default ApproveDialog
