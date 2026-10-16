// @ds-screen RD-STUDENT-01
import { EmptyState } from "@/components/app-ui/empty-state"

export const metadata = { title: "Conversation introuvable - EduCash" }

// 404 d'une conversation inexistante ou sans lien avec l'étudiant, affichée dans la coquille sous le h1 « Messages » du layout.
// Pas de loading.js dans ce segment ni dans ses parents : il transformerait le 404 en 200.
export default function ConversationNotFound() {
  return (
    <EmptyState
      titleAs="h2"
      icon="i-message"
      title="Conversation introuvable"
      text="Cette conversation n'existe pas ou n'est pas rattachée à votre compte."
      action={{ href: "/messages", label: "Retour aux messages" }}
    />
  )
}
