// @ds-screen RD-CLIENT-01
import { getClientWalletPage } from "@/lib/actions/client-wallet.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { todayInBenin } from "@/lib/app/format"
import { parseDepositReturn, parseRechargeParams } from "@/lib/client-space/deposit-return"
import { WalletView } from "@/components/client-space/wallet/wallet-view"

export const metadata = { title: "Mon portefeuille - EduCash" }

// Page mince : les données viennent de l'action (requireRole client), la vue est pure. Les paramètres d'URL
// (`filtre`, retour du prestataire, `recharger`, `montant`) sont validés avant d'atteindre la vue ; aucun
// montant lu dans l'URL n'est jamais crédité.
export default async function ClientWalletPage({ searchParams }) {
  const params = (await searchParams) ?? {}
  const result = await getClientWalletPage({ filtre: params.filtre })
  const depositReturn = parseDepositReturn(params)
  const recharge = parseRechargeParams(params)
  return (
    // La clé relance l'état de la vue (modale, bannière fermée) quand le lien « Réessayer » ou une
    // suggestion de montant arrive par une navigation dans la même page.
    <WalletView
      key={`${recharge.open}-${recharge.suggestion ?? ""}-${depositReturn?.kind ?? ""}`}
      data={result.data}
      error={result.error}
      today={todayInBenin()}
      paymentsEnabled={paymentsEnabled()}
      depositReturn={depositReturn}
      recharge={recharge}
    />
  )
}
