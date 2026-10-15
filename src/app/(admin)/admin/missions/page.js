// @ds-screen RD-ADMIN-01
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { listAdminMissions } from "@/lib/actions/admin-missions.actions"
import { MissionsView } from "@/components/admin-space/missions/missions-view"
import { SkeletonRows } from "@/components/app-ui/skeletons"

export const metadata = { title: "Missions - Admin EduCash" }

// Données lues dans un composant à part pour que le squelette s'affiche pendant le chargement.
async function MissionsContent({ params }) {
  const result = await listAdminMissions(params)
  return <MissionsView data={result.error ? null : result} error={result.error} />
}

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
// Les paramètres d'URL sont validés par l'action (statut, ville et type en listes fermées, texte borné).
export default async function AdminMissionsPage({ searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const params = (await searchParams) ?? {}
  const { statut, q, ville, type, page } = params
  return (
    <Suspense key={JSON.stringify({ statut, q, ville, type, page })} fallback={<SkeletonRows count={6} />}>
      <MissionsContent params={params} />
    </Suspense>
  )
}
