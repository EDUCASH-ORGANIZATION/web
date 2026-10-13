// @ds-screen RD-CLIENT-01
import { EmptyState } from "@/components/app-ui/empty-state"
import { clientMissionsHref } from "@/lib/app/client-routes"

export const metadata = { title: "Mission introuvable - EduCash" }

// 404 d'une mission inexistante ou qui n'appartient pas au client, affichée dans la coquille.
export default function MissionNotFound() {
  return (
    <EmptyState
      titleAs="h1"
      icon="i-briefcase"
      title="Mission introuvable"
      text="Cette mission n'existe pas ou n'est pas rattachée à votre compte."
      action={{ href: clientMissionsHref(), label: "Retour à Mes missions" }}
    />
  )
}
