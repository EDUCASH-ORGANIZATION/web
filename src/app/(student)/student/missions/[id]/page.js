// @ds-screen RD-STUDENT-01
import { cache } from "react"
import { notFound } from "next/navigation"
import { getStudentMissionDetail } from "@/lib/actions/student-mission-detail.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { pickMissionView } from "@/lib/student-space/mission-view"
import { MissionApplyView } from "@/components/student-space/mission/apply-view"
import { MissionFollowupView } from "@/components/student-space/mission/followup-view"

// Une seule lecture par rendu : les métadonnées et la page partagent le résultat.
const loadDetail = cache(getStudentMissionDetail)

export async function generateMetadata({ params }) {
  const { id } = await params
  try {
    const detail = await loadDetail(id)
    if (!detail) return { title: "Mission introuvable - EduCash" }
    // Une mission plus ouverte n'expose aucun titre.
    return { title: detail.state === "closed" ? "Mission - EduCash" : `${detail.mission.title} - EduCash` }
  } catch {
    return { title: "Mission - EduCash" }
  }
}

export default async function StudentMissionDetailPage({ params, searchParams }) {
  const { id } = await params
  const query = (await searchParams) ?? {}

  const detail = await loadDetail(id)
  if (!detail) notFound()

  const flags = { postuler: query.postuler === "1", paymentsEnabled: paymentsEnabled() }

  if (pickMissionView(detail) === "followup") return <MissionFollowupView detail={detail} flags={flags} />
  return <MissionApplyView detail={detail} flags={flags} />
}
