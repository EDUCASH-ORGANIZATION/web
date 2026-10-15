// @ds-screen RD-ADMIN-01
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { listAdminTransactions } from "@/lib/actions/admin-finance.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { TransactionsView } from "@/components/admin-space/finance/transactions-view"
import { SkeletonRows } from "@/components/app-ui/skeletons"

export const metadata = { title: "Transactions - Admin EduCash" }

// Données lues dans un composant à part pour que le squelette s'affiche pendant le chargement.
async function Content({ params }) {
  const result = await listAdminTransactions(params)
  return <TransactionsView data={result.error ? null : result} error={result.error} paymentsEnabled={paymentsEnabled()} />
}

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
// Les paramètres d'URL sont validés par l'action (listes fermées, référence nettoyée, page bornée).
export default async function AdminTransactionsPage({ searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const params = (await searchParams) ?? {}
  const { type, periode, q, page } = params
  return (
    <Suspense key={JSON.stringify({ type, periode, q, page })} fallback={<SkeletonRows count={6} />}>
      <Content params={params} />
    </Suspense>
  )
}
