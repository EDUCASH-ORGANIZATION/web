import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronRight, MapPin } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { MissionDetailTabs } from "@/components/client/mission-detail-tabs"

export async function generateMetadata({ params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from("missions")
    .select("title")
    .eq("id", id)
    .single()

  return {
    title: data ? `${data.title} — EduCash` : "Mission — EduCash",
  }
}

function formatMoney(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

const URGENCY_BADGE = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-orange-100 text-orange-700",
  low:    "bg-gray-100 text-gray-600",
}

const URGENCY_LABELS = { high: "Urgent", medium: "Moyen", low: "Normal" }

export default async function ClientMissionDetailPage({ params }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [{ data: mission }, { data: applications }] = await Promise.all([
    supabase
      .from("missions")
      .select("*")
      .eq("id", id)
      .eq("client_id", user.id) // garde : seul le propriétaire
      .single(),

    supabase
      .from("applications")
      .select("*, profiles!student_id(*), student_profiles!student_id(*)")
      .eq("mission_id", id)
      .order("created_at", { ascending: false }),
  ])

  if (!mission) notFound()

  const urgencyBadgeClass = URGENCY_BADGE[mission.urgency] ?? URGENCY_BADGE.low

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto flex flex-col gap-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap">
        <Link href="/client/dashboard" className="hover:text-[#1A6B4A] transition-colors">
          Tableau de bord
        </Link>
        <ChevronRight size={14} className="text-gray-300 shrink-0" />
        <Link href="/client/missions" className="hover:text-[#1A6B4A] transition-colors">
          Mes missions
        </Link>
        <ChevronRight size={14} className="text-gray-300 shrink-0" />
        <span className="text-gray-700 font-medium truncate max-w-[200px]">
          {mission.title.length > 30 ? mission.title.slice(0, 30) + "…" : mission.title}
        </span>
      </nav>

      {/* En-tête mission */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            {mission.type}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${urgencyBadgeClass}`}>
            {URGENCY_LABELS[mission.urgency] ?? "Normal"}
          </span>
          <Badge status={mission.status} />
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 leading-snug flex-1">
            {mission.title}
          </h1>
          <p className="text-xl font-bold text-[#1A6B4A] shrink-0">
            {formatMoney(mission.budget)} FCFA
          </p>
        </div>

        <p className="flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin size={14} className="shrink-0" />
          {mission.city}
        </p>
      </div>

      {/* Onglets */}
      <MissionDetailTabs
        mission={mission}
        applications={applications ?? []}
      />
    </div>
  )
}
