// @ds-screen RD-STUDENT-01
// Ligne système d'un événement de demande de paiement d'achats dans le fil (« La demande N° 2 est marquée « Payé » »).
// Le texte est celui que le serveur écrit (`purchaseMessageContent`) : sans nom, sans montant, sans numéro de vendeur.
import { Icon } from "@/components/design/icon"
import { purchaseMessageContent } from "@/lib/purchases/requests"

const EVENT_ICONS = {
  updated: "i-pencil",
  cancelled: "i-x",
  paid: "i-check",
  received: "i-check-circle",
  reported: "i-flag",
}

/**
 * @param {{ event: "updated"|"cancelled"|"paid"|"received"|"reported", seq: number }} props
 * Ne rend rien si l'événement ou le numéro est invalide.
 */
export function PurchaseEventLine({ event, seq }) {
  const text = purchaseMessageContent("purchase_event", seq, event)
  if (!text) return null
  return (
    <div className="msg-system">
      <Icon name={EVENT_ICONS[event]} />
      {text}
    </div>
  )
}

export default PurchaseEventLine
