// @ds-screen RD-CLIENT-01
import { cache } from "react"
import { notFound } from "next/navigation"
import { getClientMissionDetail, getCandidateProfile } from "@/lib/actions/client-mission-detail.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { MissionOpenView } from "@/components/client-space/mission-detail/open-view"
import { MissionFollowupView } from "@/components/client-space/mission-detail/followup-view"

// Une seule lecture par rendu : les métadonnées et la page partagent le résultat.
const loadDetail = cache(getClientMissionDetail)

export async function generateMetadata({ params }) {
  const { id } = await params
  try {
    const detail = await loadDetail(id)
    return { title: detail ? `${detail.mission.title} - EduCash` : "Mission introuvable - EduCash" }
  } catch {
    return { title: "Mission - EduCash" }
  }
}

// Premier paramètre d'URL sous forme de texte (jamais un tableau ni autre chose).
function paramText(value) {
  return typeof value === "string" ? value : undefined
}

export default async function ClientMissionDetailPage({ params, searchParams }) {
  const { id } = await params
  const query = (await searchParams) ?? {}

  const detail = await loadDetail(id)
  if (!detail) notFound()

  const flags = {
    confirmer: paramText(query.confirmer) === "1",
    publiee: paramText(query.publiee) === "1",
    paymentsEnabled: paymentsEnabled(),
  }

  if (detail.mission.status === "open") {
    const candidatId = paramText(query.candidat)
    const candidate = candidatId ? await getCandidateProfile(detail.mission.id, candidatId) : null
    return <MissionOpenView detail={detail} candidate={candidate} flags={flags} />
  }
  return <MissionFollowupView detail={detail} flags={flags} />
}
