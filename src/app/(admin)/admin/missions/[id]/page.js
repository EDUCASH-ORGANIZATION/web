// @ds-screen RD-ADMIN-01
import { notFound, redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getAdminMissionDetail } from "@/lib/actions/admin-mission-detail.actions"
import { MissionDetailView } from "@/components/admin-space/mission-detail/mission-detail-view"

export const metadata = { title: "Mission - Admin EduCash" }

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
// Identifiant mal formé ou inconnu : 404 (appelé hors try/catch, sans Suspense ni loading.js pour garder le statut).
export default async function AdminMissionDetailPage({ params } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const { id } = (await params) ?? {}
  const result = await getAdminMissionDetail(id)
  if (result.notFound) notFound()
  return <MissionDetailView data={result.error ? null : result} error={result.error} />
}
