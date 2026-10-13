// @ds-screen RD-CLIENT-01
import { EmptyState } from "@/components/app-ui/empty-state"
import { clientMissionsHref } from "@/lib/app/client-routes"

export const metadata = { title: "Mission introuvable - EduCash" }

// 404 d'une mission à noter inexistante ou qui n'appartient pas au client, affichée dans la coquille.
// Pas de loading.js dans ce segment ni dans ses parents : il transformerait le 404 en 200.
export default function ReviewNotFound() {
  return (
    <EmptyState
      titleAs="h1"
      icon="i-star"
      title="Mission introuvable"
      text="Cette mission n'existe pas ou n'est pas rattachée à votre compte."
      action={{ href: clientMissionsHref(), label: "Retour à Mes missions" }}
    />
  )
}
