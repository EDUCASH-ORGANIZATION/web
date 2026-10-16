// @ds-screen RD-STUDENT-01
import { Suspense } from "react"
import { getStudentApplicationsView } from "@/lib/actions/student-applications.actions"
import { getStudentConversations } from "@/lib/actions/message.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { StudentApplicationsView, StudentApplicationsSkeleton } from "@/components/student-space/applications/applications-view"
import { unreadByMission } from "@/components/student-space/applications/unread-by-mission"

export const metadata = { title: "Mes candidatures - EduCash" }

async function ApplicationsContent({ onglet }) {
  // Les non lus sont facultatifs : une erreur de la messagerie retire seulement l'action « Répondre ».
  const [result, conversations] = await Promise.all([getStudentApplicationsView({ onglet }), getStudentConversations()])
  return (
    <StudentApplicationsView
      result={result}
      unreadByMission={unreadByMission(conversations)}
      now={new Date().toISOString()}
      paymentsEnabled={paymentsEnabled()}
    />
  )
}

// Page mince : les données viennent des actions (requireRole étudiant), la vue est pure.
// Valeur brute de ?onglet= : l'action ramène une valeur invalide à l'onglet par défaut.
export default async function StudentApplicationsPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  return (
    <Suspense key={JSON.stringify(sp.onglet ?? null)} fallback={<StudentApplicationsSkeleton />}>
      <ApplicationsContent onglet={sp.onglet} />
    </Suspense>
  )
}
