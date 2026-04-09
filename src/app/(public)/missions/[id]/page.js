import Image from "next/image"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronRight, MapPin, Calendar, Clock, Star } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { PublicNavbar } from "@/components/home/public-navbar"
import { PublicFooter } from "@/components/home/public-footer"
import { ApplySidebar } from "@/components/missions/apply-sidebar"
import { ApplyStickyButton } from "@/components/missions/apply-sticky-button"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const URGENCY_LABELS = { high: "Urgent", medium: "Cette semaine", low: "Normal" }
const URGENCY_BADGE = {
  high:   "bg-red-100 text-red-700 border border-red-200",
  medium: "bg-orange-100 text-orange-700 border border-orange-200",
  low:    "bg-gray-100 text-gray-600 border border-gray-200",
}

const TYPE_COLORS = {
  "Babysitting":           "bg-purple-50 text-purple-700 border border-purple-200",
  "Livraison":             "bg-blue-50 text-blue-700 border border-blue-200",
  "Aide administrative":   "bg-teal-50 text-teal-700 border border-teal-200",
  "Saisie":                "bg-indigo-50 text-indigo-700 border border-indigo-200",
  "Community Management":  "bg-pink-50 text-pink-700 border border-pink-200",
  "Traduction":            "bg-cyan-50 text-cyan-700 border border-cyan-200",
  "Cours particuliers":    "bg-green-50 text-green-700 border border-green-200",
  "Autre":                 "bg-gray-100 text-gray-600 border border-gray-200",
}

function formatBudget(n) {
  return new Intl.NumberFormat("fr-FR").format(n)
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function truncate(str, max) {
  return str?.length > max ? str.slice(0, max) + "…" : str
}

// ─── Métadonnées SEO ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: mission } = await supabase
    .from("missions")
    .select("title, description")
    .eq("id", id)
    .single()

  if (!mission) return { title: "Mission introuvable — EduCash" }

  return {
    title: `${mission.title} — EduCash`,
    description: mission.description?.substring(0, 160) ?? "",
  }
}

// ─── Mini card mission similaire ─────────────────────────────────────────────

function SimilarMissionCard({ mission }) {
  const typeClass = TYPE_COLORS[mission.type] ?? TYPE_COLORS["Autre"]
  return (
    <Link
      href={`/missions/${mission.id}`}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3 group"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${typeClass}`}>
          {mission.type}
        </span>
        <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg whitespace-nowrap">
          {formatBudget(mission.budget)} FCFA
        </span>
      </div>
      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-[#1A6B4A] transition-colors">
        {mission.title}
      </p>
      {mission.city && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <MapPin size={11} strokeWidth={2} />
          {mission.city}
        </p>
      )}
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MissionDetailPage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: mission } = await supabase
    .from("missions")
    .select("*")
    .eq("id", id)
    .single()

  if (!mission) notFound()

  const [{ data: clientProfile }, { data: similarMissions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, city, avatar_url, rating, missions_done, is_verified")
      .eq("user_id", mission.client_id)
      .single(),
    supabase
      .from("missions")
      .select("id, title, type, city, budget")
      .eq("type", mission.type)
      .eq("status", "open")
      .neq("id", mission.id)
      .limit(4),
  ])

  const clientName = clientProfile?.full_name ?? "Client EduCash"
  const clientInitial = clientName.charAt(0).toUpperCase()
  const rating = clientProfile?.rating ?? 0
  const missionsDone = clientProfile?.missions_done ?? 0
  const urgencyClass = URGENCY_BADGE[mission.urgency] ?? URGENCY_BADGE.low
  const typeClass = TYPE_COLORS[mission.type] ?? TYPE_COLORS["Autre"]

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <PublicNavbar />

      <div className="max-w-6xl mx-auto px-4 py-8 pb-28 lg:pb-12">

        {/* ── Breadcrumb ────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6 flex-wrap">
          <Link href="/missions" className="hover:text-[#1A6B4A] transition-colors font-semibold uppercase tracking-wide">
            Missions
          </Link>
          <ChevronRight size={13} className="text-gray-300 shrink-0" />
          <span className="font-semibold uppercase tracking-wide text-gray-400">{mission.type}</span>
          <ChevronRight size={13} className="text-gray-300 shrink-0" />
          <span className="text-gray-600 font-medium truncate max-w-[220px]">
            {truncate(mission.title, 35)}
          </span>
        </nav>

        {/* ── Corps : 2 colonnes ────────────────────────────────────────── */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">

          {/* ── Colonne gauche (2/3) ──────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Carte principale */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${typeClass}`}>
                  {mission.type}
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${urgencyClass}`}>
                  {URGENCY_LABELS[mission.urgency] ?? "Normal"}
                </span>
              </div>

              {/* Titre */}
              <h1 className="text-2xl font-black text-gray-900 leading-snug">
                {mission.title}
              </h1>

              {/* Méta */}
              <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                {mission.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-gray-400 shrink-0" />
                    {mission.city}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400 shrink-0" />
                  Publiée le {formatDate(mission.created_at)}
                </span>
              </div>

              <hr className="border-gray-100" />

              {/* Description */}
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">
                  Description
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {mission.description}
                </p>
              </div>

              <hr className="border-gray-100" />

              {/* Infos clés */}
              <div className="grid grid-cols-2 gap-4">
                {mission.deadline && (
                  <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock size={11} />
                      Date limite
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatDate(mission.deadline)}
                    </p>
                  </div>
                )}
                <div className="bg-amber-50 rounded-xl p-4 flex flex-col gap-1">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                    Rémunération
                  </p>
                  <p className="text-sm font-black text-amber-700">
                    {formatBudget(mission.budget)} <span className="text-xs font-bold">FCFA</span>
                  </p>
                </div>
              </div>
            </div>

            {/* ── Card client ──────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
                À propos du client
              </h2>
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
                  {clientProfile?.avatar_url ? (
                    <Image
                      src={clientProfile.avatar_url}
                      alt={clientName}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-white text-xl font-black">{clientInitial}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{clientName}</p>
                    {clientProfile?.is_verified && (
                      <span className="text-[10px] font-bold text-[#1A6B4A] bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        Vérifié
                      </span>
                    )}
                  </div>
                  {clientProfile?.city && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} className="shrink-0" />
                      {clientProfile.city}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {rating > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                        <Star size={11} fill="currentColor" />
                        {rating.toFixed(1)}
                      </span>
                    )}
                    {missionsDone > 0 && (
                      <span className="text-xs text-gray-400">
                        {missionsDone} mission{missionsDone > 1 ? "s" : ""} publiée{missionsDone > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Missions similaires ──────────────────────────────────── */}
            {similarMissions?.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">
                  Missions similaires
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {similarMissions.map((m) => (
                    <SimilarMissionCard key={m.id} mission={m} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Colonne droite sticky — desktop uniquement ───────────── */}
          <div className="hidden lg:block">
            <ApplySidebar
              missionId={mission.id}
              missionTitle={mission.title}
              clientName={clientName}
              budget={mission.budget}
              estimatedDuration={mission.estimated_duration ?? null}
            />
          </div>
        </div>
      </div>

      <PublicFooter />

      {/* Barre sticky mobile */}
      <ApplyStickyButton missionId={mission.id} missionTitle={mission.title} />
    </div>
  )
}
