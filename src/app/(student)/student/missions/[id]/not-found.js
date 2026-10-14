// @ds-screen RD-STUDENT-01
import { EmptyState } from "@/components/app-ui/empty-state"
import { studentMissionsHref } from "@/lib/app/student-routes"

export const metadata = { title: "Mission introuvable - EduCash" }

// 404 d'une mission inexistante ou d'un identifiant invalide, affichée dans la coquille.
export default function MissionNotFound() {
  return (
    <EmptyState
      titleAs="h1"
      icon="i-briefcase"
      title="Mission introuvable"
      text="Cette mission n'existe pas ou n'est plus disponible."
      action={{ href: studentMissionsHref(), label: "Voir les missions" }}
    />
  )
}
