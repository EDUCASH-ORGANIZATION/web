import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Plus, Briefcase, Clock, CheckCircle, XCircle,
  MapPin, Users, Zap, Calendar, ChevronRight,
} from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Mes missions — EduCash" }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  if (days > 30) return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(dateStr))
  if (days > 0) return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  return "à l'instant"
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86400000)
  return diff > 0 ? diff : null
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open:        { label: "Ouverte",   cls: "bg-blue-100 text-blue-700",   dot: "bg-blue-400" },
  in_progress: { label: "En cours",  cls: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  done:        { label: "Terminée",  cls: "bg-green-100 text-green-700", dot: "bg-green-400" },
  cancelled:   { label: "Annulée",   cls: "bg-gray-100 text-gray-500",   dot: "bg-gray-400" },
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

const URGENCY_CONFIG = {
  high:   { label: "Critique", cls: "text-red-600 bg-red-50 border-red-200" },
  medium: { label: "Urgent",   cls: "text-amber-600 bg-amber-50 border-amber-200" },
  low:    null,
}

const TABS = [
  { value: "open",        label: "Ouvertes",  icon: Briefcase  },
  { value: "in_progress", label: "En cours",  icon: Clock      },
  { value: "done",        label: "Terminées", icon: CheckCircle },
  { value: "cancelled",   label: "Annulées",  icon: XCircle    },
]

// ─── Mission card ─────────────────────────────────────────────────────────────

function MissionCard({ mission }) {
  const appCount   = mission.applications?.[0]?.count ?? 0
  const status     = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.open
  const typeColor  = TYPE_COLORS[mission.type] ?? "bg-gray-100 text-gray-600"
  const urgency    = URGENCY_CONFIG[mission.urgency]
  const days       = daysUntil(mission.deadline)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">

      {/* Header */}
      <div className="px-5 pt-5 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg ${typeColor}`}>
            {mission.type}
          </span>
          {urgency && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${urgency.cls}`}>
              {urgency.label}
            </span>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* Content */}
      <div className="px-5 py-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 flex-1">
            {mission.title}
          </h3>
          <div className="shrink-0 text-right">
            <p className="text-lg font-black text-[#1A6B4A] leading-none">{fmt(mission.budget)}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">FCFA</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
          {mission.city && (
            <span className="flex items-center gap-1">
              <MapPin size={11} className="shrink-0" />
              {mission.city}
            </span>
          )}
          {days && (
            <span className="flex items-center gap-1 text-amber-600 font-semibold">
              <Calendar size={11} className="shrink-0" />
              {days}j restant{days > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between border-t border-gray-50 pt-3 mt-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Users size={13} className="text-gray-400" />
            {appCount} candidature{appCount !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-gray-300">{timeAgo(mission.created_at)}</span>
        </div>
        <Link
          href={`/client/missions/${mission.id}`}
          className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#1A6B4A] text-white text-xs font-bold hover:bg-[#155a3d] transition-colors touch-manipulation"
        >
          Gérer
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const EMPTY = {
  open:        { title: "Aucune mission ouverte",  desc: "Publiez votre première mission pour trouver un étudiant.", cta: true  },
  in_progress: { title: "Aucune mission en cours", desc: "Les missions avec un étudiant accepté apparaîtront ici.",  cta: false },
  done:        { title: "Aucune mission terminée", desc: "Vos missions complétées apparaîtront ici.",                cta: false },
  cancelled:   { title: "Aucune mission annulée",  desc: "Vos missions annulées apparaîtront ici.",                 cta: false },
}

function EmptyState({ tab }) {
  const cfg = EMPTY[tab] ?? EMPTY.open
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Briefcase size={28} className="text-gray-300" />
      </div>
      <p className="text-base font-bold text-gray-700 mb-1">{cfg.title}</p>
      <p className="text-sm text-gray-400 max-w-xs mb-6">{cfg.desc}</p>
      {cfg.cta && (
        <Link
          href="/client/missions/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors"
        >
          <Plus size={15} />
          Publier une mission
        </Link>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientMissionsPage({ searchParams }) {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const { tab } = await searchParams
  const activeTab = tab || "open"

  const supabase = await createClient()

  const [
    { data: missions },
    { count: openCount },
    { count: inProgressCount },
    { count: doneCount },
    { count: cancelledCount },
    { count: totalCount },
  ] = await Promise.all([
    supabase
      .from("missions")
      .select("id, title, type, city, budget, urgency, deadline, status, created_at, applications(count)")
      .eq("client_id", user.id)
      .eq("status", activeTab)
      .order("created_at", { ascending: false }),

    supabase.from("missions").select("id", { count: "exact", head: true }).eq("client_id", user.id).eq("status", "open"),
    supabase.from("missions").select("id", { count: "exact", head: true }).eq("client_id", user.id).eq("status", "in_progress"),
    supabase.from("missions").select("id", { count: "exact", head: true }).eq("client_id", user.id).eq("status", "done"),
    supabase.from("missions").select("id", { count: "exact", head: true }).eq("client_id", user.id).eq("status", "cancelled"),
    supabase.from("missions").select("id", { count: "exact", head: true }).eq("client_id", user.id),
  ])

  const counts = {
    open: openCount ?? 0,
    in_progress: inProgressCount ?? 0,
    done: doneCount ?? 0,
    cancelled: cancelledCount ?? 0,
  }

  const list = missions ?? []

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Mes missions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalCount ?? 0} mission{(totalCount ?? 0) !== 1 ? "s" : ""} au total
          </p>
        </div>
        <Link
          href="/client/missions/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors touch-manipulation"
        >
          <Plus size={16} />
          Nouvelle mission
        </Link>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Ouvertes",      count: counts.open,        icon: Briefcase,   color: "text-blue-500",  bg: "bg-blue-50"  },
          { label: "En cours",      count: counts.in_progress, icon: Clock,       color: "text-amber-500", bg: "bg-amber-50" },
          { label: "Terminées",     count: counts.done,        icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" },
          { label: "Annulées",      count: counts.cancelled,   icon: XCircle,     color: "text-gray-400",  bg: "bg-gray-50"  },
        ].map(({ label, count, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{count}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(({ value, label, icon: Icon }) => {
            const isActive = activeTab === value
            const count = counts[value]
            return (
              <Link
                key={value}
                href={`/client/missions?tab=${value}`}
                className={`shrink-0 flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-[#1A6B4A] text-[#1A6B4A]"
                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200"
                }`}
              >
                <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} />
                {label}
                {count > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    isActive ? "bg-[#1A6B4A] text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Contenu de l'onglet */}
        {list.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
