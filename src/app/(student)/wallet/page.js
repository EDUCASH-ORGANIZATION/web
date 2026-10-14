// @ds-screen RD-STUDENT-01
import { getStudentWallet, getStudentWithdrawPrefill } from "@/lib/actions/student-wallet.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"
import { WalletView } from "@/components/student-space/wallet/wallet-view"

export const metadata = { title: "Mon portefeuille - EduCash" }

// Page mince : les données viennent des actions (requireRole étudiant), la vue est pure. `?filtre=` est validé
// par l'action ; `?retrait=1` ouvre seulement la modale (aucun retrait sans clic sur « Retirer »). Le numéro du
// profil n'est lu que si le retrait est possible, et ne sert qu'à préremplir le champ.
export default async function StudentWalletPage({ searchParams }) {
  const params = (await searchParams) ?? {}
  const result = await getStudentWallet({ filtre: params.filtre })
  const enabled = paymentsEnabled()
  const canWithdraw = enabled && result.data && result.data.wallet.available >= MIN_WITHDRAWAL_AMOUNT
  const prefillRes = canWithdraw ? await getStudentWithdrawPrefill() : null
  const openWithdraw = (Array.isArray(params.retrait) ? params.retrait[0] : params.retrait) === "1"
  return (
    // La clé relance l'état de la vue quand `?retrait=1` arrive par une navigation dans la même page.
    <WalletView
      key={openWithdraw ? "retrait" : "page"}
      data={result.data}
      error={result.error}
      paymentsEnabled={enabled}
      prefill={{ phone: prefillRes?.phone ?? "" }}
      openWithdraw={openWithdraw}
    />
  )
}
