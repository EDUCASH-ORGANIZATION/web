"use client"

// @ds-screen RD-STUDENT-01
// Feuille de confirmation « Reçu par le vendeur ? » (E07) : évite un appui accidentel, la carte est verrouillée après
// la confirmation. Vue pure, non câblée (ST-10).
//
// Contrat des props :
// - request : { vendorName, amount } ; clientName : nom du client ;
// - onConfirm() -> Promise<{ ok: true } | { error }> (succès : la feuille se ferme) ;
// - onNotReceived() : « Le vendeur n'a rien reçu », le parent ouvre le signalement de la demande ;
// - onClose().
import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { formatPurchaseAmount } from "@/lib/purchases/requests"
import { runOnce } from "./purchase-form-logic"
import { ErrorBanner } from "./purchase-parts"

export const RECEIVED_FALLBACK_ERROR = "Confirmation non enregistrée. Vérifiez votre connexion et réessayez."

export function PurchaseReceivedDialog({ request, clientName, onConfirm, onNotReceived, onClose }) {
  const guard = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const amount = formatPurchaseAmount(request.amount)

  const close = () => {
    if (!pending) onClose()
  }

  async function confirm() {
    if (guard.current) return
    setPending(true)
    setError(null)
    const outcome = await runOnce(guard, () => onConfirm(), RECEIVED_FALLBACK_ERROR)
    if (outcome.skipped) return
    if (outcome.error) {
      setPending(false)
      setError(outcome.error)
      return
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={close}
      size="sm"
      title={`${request.vendorName} a bien reçu ${amount} ?`}
      description="Vérifiez sur le téléphone du vendeur avant de confirmer."
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={onNotReceived} disabled={pending}>
            {"Le vendeur n'a rien reçu"}
          </button>
          <button
            type="button"
            className={pending ? "btn btn--dark is-loading" : "btn btn--dark"}
            onClick={confirm}
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
          >
            <Icon name="i-check" />
            <span>Oui, reçu par le vendeur</span>
          </button>
        </>
      }
    >
      <div className="stack stack--3">
        <div className="e2-note">
          <div className="e2-note__body e2-kv">
            <div className="e2-kv__row">
              <span>Vendeur</span>
              <b>{request.vendorName}</b>
            </div>
            <div className="e2-kv__row">
              <span>Montant</span>
              <b>{amount}</b>
            </div>
            <div className="e2-kv__row">
              <span>Payé par</span>
              <b>{clientName || "Le client"}, hors EduCash</b>
            </div>
          </div>
        </div>
        <p className="caption">Après confirmation, la carte est verrouillée.</p>
        {error ? <ErrorBanner title="Confirmation non enregistrée">{error}</ErrorBanner> : null}
      </div>
    </Modal>
  )
}

export default PurchaseReceivedDialog
