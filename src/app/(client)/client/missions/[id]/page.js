import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  ChevronRight, MapPin, Calendar, Zap, Users,
  Clock, CheckCircle, XCircle, FileText,
} from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { MissionDetailTabs } from "@/components/client/mission-detail-tabs"

export async function generateMetadata({ params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("missions").select("title").eq("id", id).single()
  return { title: data ? `${data.title} — EduCash` : "Mission — EduCash" }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function formatDate(iso) {
  if (!iso) return null
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso))
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86400000)
  return diff > 0 ? diff : 0
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open:        { label: "Ouverte",   cls: "bg-blue-100 text-blue-700",   dot: "bg-blue-400"  },
  in_progress: { label: "En cours",  cls: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  done:        { label: "Terminée",  cls: "bg-green-100 text-green-700", dot: "bg-green-400" },
  cancelled:   { label: "Annulée",   cls: "bg-gray-100 text-gray-500",   dot: "bg-gray-300"  },
}

const URGENCY_CONFIG = {
  high:   { label: "Critique", cls: "bg-red-100 text-red-700 border border-red-200"     },
  medium: { label: "Urgent",   cls: "bg-amber-100 text-amber-700 border border-amber-200" },
  low:    { label: "Standard", cls: "bg-gray-100 text-gray-500 border border-gray-200"  },
}

const TYPE_COLORS = {
  "Babysitting":           "bg-orange-100 text-orange-700",
  "Livraison":             "bg-sky-100 text-sky-700",
  "Aide administrative":   "bg-teal-100 text-teal-700",
  "Saisie":                "bg-indigo-100 text-indigo-700",
  "Community Management":  "bg-pink-100 text-pink-700",
  "Traduction":            "bg-blue-100 text-blue-700",
  "Cours particuliers":    "bg-amber-100 text-amber-700",
  "Autre":                 "bg-gray-100 text-gray-600",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientMissionDetailPage({ params }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [{ data: mission }, { data: rawApps }] = await Promise.all([
    supabase
      .from("missions")
      .select("*")
      .eq("id", id)
      .eq("client_id", user.id)
      .single(),

    // Pas de FK applications → profiles : requête simple sans join embarqué
    supabase
      .from("applications")
      .select("id, mission_id, student_id, message, status, created_at")
      .eq("mission_id", id)
      .order("created_at", { ascending: false }),
  ])

  if (!mission) notFound()

  // Récupère les profils et student_profiles des candidats séparément
  const studentIds = (rawApps ?? []).map((a) => a.student_id)

  const [{ data: profilesData }, { data: studentProfilesData }] = studentIds.length
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, city, rating, missions_done")
          .in("user_id", studentIds),
        supabase
          .from("student_profiles")
          .select("user_id, school, level, skills")
          .in("user_id", studentIds),
      ])
    : [{ data: [] }, { data: [] }]

  // Index par user_id pour jointure O(1)
  const profilesMap      = {}
  const studentProfilesMap = {}
  ;(profilesData ?? []).forEach((p) => { profilesMap[p.user_id] = p })
  ;(studentProfilesData ?? []).forEach((s) => { studentProfilesMap[s.user_id] = s })

  // Fusion applications + profils
  const apps = (rawApps ?? []).map((a) => ({
    ...a,
    profiles:        profilesMap[a.student_id]        ?? {},
    student_profiles: studentProfilesMap[a.student_id] ?? {},
  }))

  const status  = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.open
  const urgency = URGENCY_CONFIG[mission.urgency] ?? URGENCY_CONFIG.low
  const typeColor = TYPE_COLORS[mission.type] ?? "bg-gray-100 text-gray-600"
  const days = daysUntil(mission.deadline)

  const appCounts = {
    total:    apps.length,
    pending:  apps.filter((a) => a.status === "pending").length,
    accepted: apps.filter((a) => a.status === "accepted").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto flex flex-col gap-6">

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 flex-wrap">
        <Link href="/client/dashboard" className="hover:text-[#1A6B4A] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} className="text-gray-300 shrink-0" />
        <Link href="/client/missions" className="hover:text-[#1A6B4A] transition-colors">
          Mes missions
        </Link>
        <ChevronRight size={12} className="text-gray-300 shrink-0" />
        <span className="text-gray-600 truncate max-w-[200px]">{mission.title}</span>
      </nav>

      {/* ── Hero de la mission ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">

        {/* Badges + status */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
            <span className={`text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg ${typeColor}`}>
              {mission.type}
            </span>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${urgency.cls}`}>
              {urgency.label}
            </span>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${status.cls}`}>
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {/* Titre + budget */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <h1 className="text-2xl font-black text-gray-900 leading-snug flex-1">
            {mission.title}
          </h1>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-black text-[#1A6B4A] leading-none">{fmt(mission.budget)}</p>
            <p className="text-sm font-bold text-gray-400 mt-0.5">FCFA</p>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-4">
          {mission.city && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                <MapPin size={13} className="text-gray-400" />
              </div>
              {mission.city}
            </div>
          )}
          {mission.deadline && (
            <div className={`flex items-center gap-1.5 text-sm font-medium ${days === 0 ? "text-red-600" : days !== null && days <= 3 ? "text-amber-600" : "text-gray-500"}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${days === 0 ? "bg-red-50" : days !== null && days <= 3 ? "bg-amber-50" : "bg-gray-100"}`}>
                <Calendar size={13} />
              </div>
              {days === 0 ? "Délai dépassé" : days !== null ? `${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}` : formatDate(mission.deadline)}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
              <Clock size={13} className="text-gray-400" />
            </div>
            Publiée le {formatDate(mission.created_at)}
          </div>
        </div>

        {/* Stats candidatures */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-gray-50">
          {[
            { label: "Total",    count: appCounts.total,    icon: Users,        color: "text-gray-500",   bg: "bg-gray-100" },
            { label: "En attente", count: appCounts.pending, icon: Clock,       color: "text-blue-500",   bg: "bg-blue-50"  },
            { label: "Acceptée",  count: appCounts.accepted, icon: CheckCircle, color: "text-green-500",  bg: "bg-green-50" },
            { label: "Refusées", count: appCounts.rejected,  icon: XCircle,     color: "text-gray-400",   bg: "bg-gray-100" },
          ].map(({ label, count, icon: Icon, color, bg }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon size={16} className={color} />
              </div>
              <div>
                <p className="text-lg font-black text-gray-900 leading-none">{count}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Corps : tabs + sidebar ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* Tabs */}
        <MissionDetailTabs
          mission={mission}
          applications={apps}
        />

        {/* Sidebar */}
        <div className="lg:sticky lg:top-8 flex flex-col gap-4">

          {/* Détails mission */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <FileText size={15} className="text-[#1A6B4A]" />
              Résumé de la mission
            </h3>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</p>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">
                  {mission.description}
                </p>
              </div>

              {[
                { label: "Type",    value: mission.type },
                { label: "Ville",   value: mission.city },
                { label: "Budget",  value: `${fmt(mission.budget)} FCFA`, highlight: true },
                { label: "Urgence", value: urgency.label },
                mission.deadline && { label: "Deadline", value: formatDate(mission.deadline) },
              ].filter(Boolean).map(({ label, value, highlight }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">{label}</p>
                  <p className={`text-xs font-semibold text-right truncate ${highlight ? "text-[#1A6B4A] font-black" : "text-gray-700"}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions rapides */}
          {mission.status === "open" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
              <h3 className="text-sm font-black text-gray-900">Actions</h3>
              <Link
                href={`/client/missions/new`}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors text-center"
              >
                Dupliquer cette mission
              </Link>
            </div>
          )}

          {/* Commission info */}
          <div className="bg-[#f0faf5] rounded-2xl border border-green-100 p-4 flex flex-col gap-1.5">
            <p className="text-xs font-black text-[#1A6B4A]">Commission EduCash : 12%</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Montant versé à l&apos;étudiant : <span className="font-bold text-gray-700">{fmt(Math.round(mission.budget * 0.88))} FCFA</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
