// @ds-screen RD-STUDENT-01
import { getStudentConversations } from "@/lib/actions/message.actions"
import { StudentInboxView } from "@/components/student-space/messages/inbox-view"

// Liste des conversations persistante à gauche, conversation ouverte (ou volet vide) à droite : la lecture
// n'est pas enveloppée dans un Suspense et ce segment ne porte aucun loading.js, sinon le notFound() de [missionId]
// répondrait 200 au lieu de 404. La recherche et le filtre sont lus dans l'adresse par la liste.
export default async function StudentMessagesLayout({ children }) {
  const result = await getStudentConversations()
  return (
    <StudentInboxView result={result} now={new Date().toISOString()}>
      {children}
    </StudentInboxView>
  )
}
