// @ds-screen RD-CLIENT-01
import { notFound } from "next/navigation"
import { getClientConversation } from "@/lib/actions/message.actions"
import { ConversationView } from "@/components/client-space/messages/conversation-view"
import { ErrorState } from "@/components/app-ui/state-block"
import { paymentsEnabled } from "@/lib/constants/payments"

export const metadata = { title: "Conversation - EduCash" }

// Premier paramètre d'URL sous forme de texte (jamais un tableau ni autre chose).
function paramText(value) {
  return typeof value === "string" ? value : undefined
}

// Pas de Suspense autour de la lecture : notFound() doit répondre 404 avant l'envoi de la page, et ce
// segment ne porte aucun loading.js (même raison, voir le parent client/messages).
export default async function ClientConversationPage({ params, searchParams }) {
  const { missionId } = await params
  const query = (await searchParams) ?? {}

  const result = await getClientConversation({ missionId, studentId: paramText(query.studentId) })
  if (result.notFound) notFound()
  if (result.error || !result.conversation) {
    return (
      <ErrorState
        titleAs="h2"
        title="Conversation indisponible"
        text={result.error ?? "Le chargement a échoué. Veuillez réessayer."}
        action={{ href: "/client/messages", label: "Retour aux messages" }}
      />
    )
  }
  return <ConversationView conversation={result.conversation} now={new Date().toISOString()} paymentsEnabled={paymentsEnabled()} />
}
