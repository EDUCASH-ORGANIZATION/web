// @ds-screen RD-CLIENT-01
import { Suspense } from "react"
import { getClientMissions } from "@/lib/actions/client-missions.actions"
import { ClientMissionsView, ClientMissionsSkeleton } from "@/components/client-space/missions-list/client-missions-view"

export const metadata = { title: "Mes missions - EduCash" }

// Pas de loading.js ici : ce segment est le parent de [id], qui appelle notFound() (le 404 deviendrait un 200).
// L'attente est portée par ce <Suspense>.
async function MissionsContent({ params }) {
  const result = await getClientMissions(params)
  return <ClientMissionsView result={result} />
}

export default async function ClientMissionsPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  // Valeurs brutes : l'action valide l'onglet (alias tab et status compris) et échappe la recherche.
  const params = { onglet: sp.onglet, tab: sp.tab, status: sp.status, q: sp.q }
  return (
    <Suspense key={JSON.stringify(params)} fallback={<ClientMissionsSkeleton />}>
      <MissionsContent params={params} />
    </Suspense>
  )
}
