// @ds-screen RD-STUDENT-01
import { notFound } from "next/navigation"
import { getStudentConversation } from "@/lib/actions/message.actions"
import { StudentConversationView } from "@/components/student-space/messages/conversation-view"
import { ErrorState } from "@/components/app-ui/state-block"

export const metadata = { title: "Conversation - EduCash" }

// Pas de Suspense autour de la lecture : notFound() doit répondre 404 avant l'envoi de la page, et ce
// segment ne porte aucun loading.js (ni son parent messages : il transformerait le 404 en 200).
// L'interlocuteur est toujours le client de la mission, lu par l'action : jamais pris dans l'adresse.
export default async function StudentConversationPage({ params }) {
  const { missionId } = await params

  const result = await getStudentConversation({ missionId })
  if (result.notFound) notFound()
  if (result.error || !result.conversation) {
    return (
      <ErrorState
        titleAs="h2"
        title="Conversation indisponible"
        text={result.error ?? "Le chargement a échoué. Veuillez réessayer."}
        action={{ href: "/messages", label: "Retour aux messages" }}
      />
    )
  }
  return <StudentConversationView conversation={result.conversation} now={new Date().toISOString()} />
}
