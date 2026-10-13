import { paymentsEnabled } from "@/lib/constants/payments"
import { VitrineNavbarClient } from "./vitrine-navbar-client"

// En-tête public de la vitrine. Enveloppe serveur : lit le drapeau des paiements et le transmet au
// composant client (le drapeau n'est jamais exposé par NEXT_PUBLIC). Voir vitrine-navbar-client.jsx.
export function VitrineNavbar(props) {
  return <VitrineNavbarClient {...props} paymentsEnabled={paymentsEnabled()} />
}
