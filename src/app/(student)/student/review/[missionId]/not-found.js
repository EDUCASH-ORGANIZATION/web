// @ds-screen RD-STUDENT-01
import { EmptyState } from "@/components/app-ui/empty-state"
import { studentApplicationsHref } from "@/lib/app/student-routes"

export const metadata = { title: "Mission introuvable - EduCash" }

// 404 d'une mission à noter inexistante, d'un autre étudiant ou dont vous n'êtes pas l'étudiant retenu.
// Pas de loading.js dans ce segment ni dans ses parents : il transformerait le 404 en 200.
export default function ReviewNotFound() {
  return (
    <EmptyState
      titleAs="h1"
      icon="i-star"
      title="Mission introuvable"
      text="Cette mission n'existe pas ou ne fait pas partie de vos missions."
      action={{ href: studentApplicationsHref(), label: "Retour à mes candidatures" }}
    />
  )
}
