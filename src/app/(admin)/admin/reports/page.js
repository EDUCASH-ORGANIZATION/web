// @ds-screen RD-ADMIN-01
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { listAdminReports } from "@/lib/actions/admin-reports.actions"
import { ReportsView } from "@/components/admin-space/reports/reports-view"
import { SkeletonRows } from "@/components/app-ui/skeletons"

export const metadata = { title: "Signalements - Admin EduCash" }

// Données lues dans un composant à part pour que le squelette s'affiche pendant le chargement.
async function ReportsContent({ params }) {
  const result = await listAdminReports(params)
  return <ReportsView data={result.error ? null : result} error={result.error} />
}

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
// Les paramètres d'URL (onglet, tri, page) sont validés par l'action : une valeur inconnue retombe sur le défaut.
export default async function AdminReportsPage({ searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const params = (await searchParams) ?? {}
  const { statut, tri, page } = params
  return (
    <Suspense key={JSON.stringify({ statut, tri, page })} fallback={<SkeletonRows count={6} />}>
      <ReportsContent params={params} />
    </Suspense>
  )
}
