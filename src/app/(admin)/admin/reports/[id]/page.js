// @ds-screen RD-ADMIN-01
import { notFound, redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getAdminReport } from "@/lib/actions/admin-reports.actions"
import { ReportDetailView } from "@/components/admin-space/reports/report-detail-view"

export const metadata = { title: "Signalement - Admin EduCash" }

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
// Identifiant mal formé ou inconnu : 404 (appelé hors try/catch, sans Suspense ni loading.js pour garder le statut).
export default async function AdminReportDetailPage({ params } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const { id } = (await params) ?? {}
  const result = await getAdminReport(id)
  if (result.notFound) notFound()
  return <ReportDetailView data={result.error ? null : result} error={result.error} />
}
