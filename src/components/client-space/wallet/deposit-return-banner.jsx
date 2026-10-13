"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { clientWalletHref } from "@/lib/app/client-routes"

// Textes par état de retour de recharge. `approved` dans l'URL n'est pas une preuve de paiement :
// l'état reste « en attente de confirmation » et le solde affiché, crédité par le serveur, fait foi.
const COPY = {
  pending: {
    tone: "banner--alerte",
    icon: "i-clock",
    title: "Paiement en attente de confirmation",
    text: "Votre paiement n'est pas encore confirmé. Votre disponible sera mis à jour dès sa réception. Ne payez pas une seconde fois.",
  },
  cancelled: {
    tone: "banner--info",
    icon: "i-info",
    title: "Paiement annulé, votre portefeuille n'a pas été modifié",
    text: "Vous avez quitté la page de paiement avant de payer. Rien n'a été débité.",
  },
  failed: {
    tone: "banner--erreur",
    icon: "i-alert-circle",
    title: "Le paiement a échoué",
    text: "Le paiement n'a pas abouti. Votre portefeuille n'a pas été modifié.",
  },
}

/** Vue pure. `onRefresh` et `onDismiss` viennent de l'extérieur. */
export function DepositReturnBannerView({ kind, canRetry, onRefresh, onDismiss }) {
  const copy = COPY[kind]
  if (!copy) return null
  return (
    <div className={`banner ${copy.tone}`} role="status">
      <Icon name={copy.icon} />
      <div className="banner__body">
        <div className="banner__title">{copy.title}</div>
        {copy.text}
      </div>
      <div className="banner__actions">
        {kind === "pending" ? (
          <button type="button" className="btn btn--soft btn--sm" onClick={onRefresh}>
            <Icon name="i-refresh" />
            Actualiser
          </button>
        ) : null}
        {kind !== "pending" && canRetry ? (
          <Link className="link2" href={clientWalletHref({ recharger: true })}>
            Réessayer
          </Link>
        ) : null}
        {kind === "failed" ? (
          <Link className="link2 link2--muted" href="/contact?sujet=question">
            Contacter l&apos;aide
          </Link>
        ) : null}
        <button type="button" className="btn-icon btn-icon--sm" aria-label="Fermer ce message" onClick={onDismiss}>
          <Icon name="i-x" />
        </button>
      </div>
    </div>
  )
}

/**
 * Bannière de retour du prestataire de paiement. `kind` vient de `parseDepositReturn` (valeur validée).
 * @param {{ kind: "pending"|"cancelled"|"failed", paymentsEnabled: boolean }} props
 */
export function DepositReturnBanner({ kind, paymentsEnabled }) {
  const router = useRouter()
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <DepositReturnBannerView
      kind={kind}
      canRetry={paymentsEnabled}
      onRefresh={() => router.refresh()}
      onDismiss={() => setVisible(false)}
    />
  )
}

export default DepositReturnBanner
