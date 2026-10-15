// @ds-screen RD-ADMIN-01
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { listAdminWithdrawals } from "@/lib/actions/admin-finance.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { WithdrawalsView } from "@/components/admin-space/finance/withdrawals-view"
import { SkeletonRows } from "@/components/app-ui/skeletons"

export const metadata = { title: "Retraits - Admin EduCash" }

// Données lues dans un composant à part pour que le squelette s'affiche pendant le chargement.
async function Content({ params }) {
  const result = await listAdminWithdrawals(params)
  return <WithdrawalsView data={result.error ? null : result} error={result.error} paymentsEnabled={paymentsEnabled()} />
}

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
export default async function AdminWithdrawalsPage({ searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const params = (await searchParams) ?? {}
  return (
    <Suspense key={JSON.stringify({ page: params.page })} fallback={<SkeletonRows count={6} />}>
      <Content params={params} />
    </Suspense>
  )
}
