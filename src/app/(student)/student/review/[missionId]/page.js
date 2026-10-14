// @ds-screen RD-STUDENT-01
import { notFound } from "next/navigation"
import { getStudentReviewPage } from "@/lib/actions/review.actions"
import { ReviewView } from "@/components/student-space/review/review-view"

export const metadata = { title: "Noter le client - EduCash" }

// Page mince : les données viennent de l'action (requireRole étudiant, mission dont l'étudiant est le retenu
// seulement) ; la vue est pure. Mission inconnue, d'un autre étudiant ou non retenu : 404.
// Pas de loading.js dans ce segment ni dans ses parents : il transformerait le 404 en 200.
export default async function StudentReviewPage({ params }) {
  const { missionId } = await params
  const page = await getStudentReviewPage(missionId)
  if (!page) notFound()
  return <ReviewView page={page} />
}
