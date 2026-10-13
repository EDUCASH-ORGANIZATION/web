// @ds-screen RD-CLIENT-01
import { notFound } from "next/navigation"
import { getClientReviewPage } from "@/lib/actions/review.actions"
import { ReviewView } from "@/components/client-space/review/review-view"

export const metadata = { title: "Noter l'étudiant - EduCash" }

// Page mince : les données viennent de l'action (requireRole client, mission du client seulement) ; la vue est pure.
// Mission introuvable ou d'un autre client : 404. Pas de loading.js dans ce segment (il transformerait le 404 en 200).
export default async function ClientReviewPage({ params }) {
  const { missionId } = await params
  const page = await getClientReviewPage(missionId)
  if (!page) notFound()
  return <ReviewView page={page} />
}
