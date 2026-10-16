import { Icon } from "@/components/design/icon"

/**
 * Ligne système d'une demande d'achats dans la conversation (message `purchase_event`). Le contenu est un texte
 * fixe écrit par le serveur (voir `purchaseMessageContent`) : sans numéro, sans nom de vendeur, sans montant.
 * Vue pure : rien n'est interprété, le texte est échappé par React.
 */
export function PurchaseEventLine({ content }) {
  if (typeof content !== "string" || content.trim() === "") return null
  return (
    <div className="msg-system">
      <Icon name="i-receipt" />
      {content}
    </div>
  )
}

export default PurchaseEventLine
