// @ds-screen RD-STUDENT-01
import { notFound } from "next/navigation"
import { getStudentConversation } from "@/lib/actions/message.actions"
import { StudentConversationView } from "@/components/student-space/messages/conversation-view"
import { paymentsEnabled } from "@/lib/constants/payments"
import { isUuid } from "@/lib/purchases/proofs"
import { ErrorState } from "@/components/app-ui/state-block"

export const metadata = { title: "Conversation - EduCash" }

// Pas de Suspense autour de la lecture : notFound() doit répondre 404 avant l'envoi de la page, et ce
// segment ne porte aucun loading.js (ni son parent messages : il transformerait le 404 en 200).
// L'interlocuteur est toujours le client de la mission, lu par l'action : jamais pris dans l'adresse.
// Drapeaux d'URL sans action : `?achat=nouveau` ouvre le formulaire de demande, `?demande=<id>` fait défiler jusqu'à la carte.
export default async function StudentConversationPage({ params, searchParams }) {
  const { missionId } = await params
  const query = (await searchParams) ?? {}
  const initialAction = query.achat === "nouveau" ? "new" : null
  const focusRequestId = isUuid(query.demande) ? query.demande.toLowerCase() : null

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
  return (
    <StudentConversationView
      conversation={result.conversation}
      now={new Date().toISOString()}
      paymentsEnabled={paymentsEnabled()}
      initialAction={initialAction}
      focusRequestId={focusRequestId}
    />
  )
}
