// @ds-screen RD-CLIENT-01
import { getClientConversations } from "@/lib/actions/message.actions"
import { ClientInboxView } from "@/components/client-space/messages/inbox-view"

// Liste des conversations persistante à gauche, conversation ouverte (ou volet vide) à droite : la lecture
// n'est pas enveloppée dans un Suspense et ce segment ne porte aucun loading.js, sinon le notFound() de [missionId]
// répondrait 200 au lieu de 404. La recherche et le filtre sont lus dans l'adresse par la liste.
export default async function ClientMessagesLayout({ children }) {
  const result = await getClientConversations()
  return (
    <ClientInboxView result={result} now={new Date().toISOString()}>
      {children}
    </ClientInboxView>
  )
}
