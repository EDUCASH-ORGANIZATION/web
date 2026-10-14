import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { clientReviewHref } from "@/lib/app/client-routes"
import { studentReviewHref } from "@/lib/app/student-routes"

// Ancienne adresse partagée : redirection pure vers l'écran de chaque espace. Aucune lecture de mission,
// aucune écriture ici : l'avis du client passe par createClientReview, celui de l'étudiant par createStudentReview.
export default async function ReviewPage({ params }) {
  const { missionId } = await params
  const auth = await requireRole(["client", "student"])
  if (auth.error) redirect("/auth/login")
  redirect(auth.role === "client" ? clientReviewHref(missionId) : studentReviewHref(missionId))
}
