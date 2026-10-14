// @ds-screen RD-STUDENT-01
import { Suspense } from "react"
import { getStudentApplicationsView } from "@/lib/actions/student-applications.actions"
import { StudentApplicationsView, StudentApplicationsSkeleton } from "@/components/student-space/applications/applications-view"

export const metadata = { title: "Mes candidatures - EduCash" }

async function ApplicationsContent({ onglet }) {
  const result = await getStudentApplicationsView({ onglet })
  return <StudentApplicationsView result={result} />
}

// Page mince : les données viennent de l'action (requireRole étudiant), la vue est pure.
// Valeur brute de ?onglet= : l'action ramène une valeur invalide à l'onglet par défaut.
export default async function StudentApplicationsPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  return (
    <Suspense key={JSON.stringify(sp.onglet ?? null)} fallback={<StudentApplicationsSkeleton />}>
      <ApplicationsContent onglet={sp.onglet} />
    </Suspense>
  )
}
