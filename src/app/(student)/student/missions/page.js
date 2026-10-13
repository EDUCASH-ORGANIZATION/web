// @ds-screen RD-STUDENT-01
import { Suspense } from "react"
import { getStudentExplore } from "@/lib/actions/student-explore.actions"
import { StudentExploreView, StudentExploreSkeleton } from "@/components/student-space/explore/explore-view"

export const metadata = { title: "Missions - EduCash" }

// Pas de loading.js ici : ce segment est le parent de [id], qui appelle notFound() (le 404 deviendrait un 200).
// L'attente est portée par ce <Suspense>.
async function ExploreContent({ params }) {
  const result = await getStudentExplore(params)
  return <StudentExploreView result={result} />
}

export default async function StudentMissionsPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  // Valeurs brutes : l'action les valide contre les listes (types, villes, budgets, tris) et échappe la recherche.
  const params = { q: sp.q, type: sp.type, cities: sp.cities, urgency: sp.urgency, budget: sp.budget, sort: sp.sort, page: sp.page }
  return (
    <Suspense key={JSON.stringify(params)} fallback={<StudentExploreSkeleton />}>
      <ExploreContent params={params} />
    </Suspense>
  )
}
