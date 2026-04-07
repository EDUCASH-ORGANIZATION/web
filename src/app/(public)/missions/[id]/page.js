import Image from "next/image"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronRight, MapPin, Calendar, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { PublicNavbar } from "@/components/home/public-navbar"
import { PublicFooter } from "@/components/home/public-footer"
import { MissionCard } from "@/components/shared/mission-card"
import { ApplyStickyButton } from "@/components/missions/apply-sticky-button"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const URGENCY_LABELS = { high: "Urgent", medium: "Moyen", low: "Normal" }
const URGENCY_BADGE = {
  high: "bg-red-100 text-red-700",
  medium: "bg-orange-100 text-orange-700",
  low: "bg-gray-100 text-gray-600",
}

function formatBudget(n) {
  return new Intl.NumberFormat("fr-FR").format(n)
}

function formatDeadline(iso) {
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
  const supabase = await createClient()
  const { data: mission } = await supabase
    .from("missions")
    .select("title, description")
    .eq("id", params.id)
    .single()

  if (!mission) return { title: "Mission introuvable — EduCash" }

  return {
    title: `${mission.title} — EduCash`,
    description: mission.description?.substring(0, 160) ?? "",
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MissionDetailPage({ params }) {
  const supabase = await createClient()

  // Charge la mission
  const { data: mission } = await supabase
    .from("missions")
    .select("*")
    .eq("id", params.id)
    .single()

  if (!mission) notFound()

  // Charge le profil du client + missions similaires en parallèle
  const [{ data: clientProfile }, { data: similarMissions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, city, avatar_url")
      .eq("user_id", mission.client_id)
      .single(),
    supabase
      .from("missions")
      .select("*")
      .eq("type", mission.type)
      .eq("status", "open")
      .neq("id", mission.id)
      .limit(2),
  ])

  const clientInitial = clientProfile?.full_name?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />

      {/* Contenu — pb-24 sur mobile pour laisser place à la barre sticky */}
      <div className="max-w-3xl mx-auto px-4 py-8 pb-28 lg:pb-12 flex flex-col gap-8">

        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap">
          <Link href="/" className="hover:text-[#1A6B4A] transition-colors">Accueil</Link>
          <ChevronRight size={14} className="text-gray-400 shrink-0" />
          <Link href="/missions" className="hover:text-[#1A6B4A] transition-colors">Missions</Link>
          <ChevronRight size={14} className="text-gray-400 shrink-0" />
          <span className="text-gray-700 font-medium truncate max-w-[200px]">
            {truncate(mission.title, 30)}
          </span>
        </nav>

        {/* ── En-tête mission ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              {mission.type}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${URGENCY_BADGE[mission.urgency] ?? URGENCY_BADGE.low}`}>
              {URGENCY_LABELS[mission.urgency] ?? "Normal"}
            </span>
          </div>

          {/* Titre */}
          <h1 className="text-2xl font-bold text-gray-900 leading-snug">
            {mission.title}
          </h1>

          {/* Ville + budget — info prominente */}
          <p className="text-xl font-bold text-green-700 flex flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <MapPin size={18} className="shrink-0" />
              {mission.city}
            </span>
            <span className="text-gray-300 font-light">·</span>
            <span>💰 {formatBudget(mission.budget)} FCFA</span>
          </p>

          {/* Deadline + urgence */}
          <p className="text-sm text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
            {mission.deadline && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="shrink-0" />
                {formatDeadline(mission.deadline)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Zap size={14} className="shrink-0" />
              {URGENCY_LABELS[mission.urgency] ?? "Normal"}
            </span>
          </p>
        </div>

        <hr className="border-gray-200" />

        {/* ── Description ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-900">Description</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {mission.description}
          </p>
        </section>

        <hr className="border-gray-200" />

        {/* ── À propos du client ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-900">À propos du client</h2>
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="relative w-12 h-12 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
              {clientProfile?.avatar_url ? (
                <Image
                  src={clientProfile.avatar_url}
                  alt={clientProfile.full_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="text-white text-lg font-bold">{clientInitial}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Client EduCash</p>
              {clientProfile?.city && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={11} className="shrink-0" />
                  {clientProfile.city}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Missions similaires ────────────────────────────────────────── */}
        {similarMissions?.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-gray-900">Missions similaires</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {similarMissions.map((m) => (
                <Link key={m.id} href={`/missions/${m.id}`} className="block">
                  <MissionCard mission={m} showApplyButton={false} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <PublicFooter />

      {/* Barre de candidature fixe (mobile) */}
      <ApplyStickyButton missionId={mission.id} missionTitle={mission.title} />
    </div>
  )
}
