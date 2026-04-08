import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { MapPin, Zap, Calendar, ChevronLeft, ChevronRight  } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { MISSION_TYPES, CITIES } from "@/lib/supabase/database.constants"
import { MissionsFiltersSidebar } from "@/components/student/missions-filters-sidebar"
import { SortSelect } from "@/components/student/sort-select"

export const metadata = { title: "Missions — EduCash" }

const PAGE_SIZE = 9

// ─── Couleurs par type ────────────────────────────────────────────────────────

const TYPE_COLORS = {
  "Babysitting":           { bg: "bg-orange-100",  text: "text-orange-700" },
  "Livraison":             { bg: "bg-sky-100",     text: "text-sky-700" },
  "Aide administrative":   { bg: "bg-teal-100",    text: "text-teal-700" },
  "Saisie":                { bg: "bg-indigo-100",  text: "text-indigo-700" },
  "Community Management":  { bg: "bg-pink-100",    text: "text-pink-700" },
  "Traduction":            { bg: "bg-blue-100",    text: "text-blue-700" },
  "Cours particuliers":    { bg: "bg-amber-100",   text: "text-amber-700" },
  "Autre":                 { bg: "bg-gray-100",    text: "text-gray-600" },
}

// ─── Mission card ─────────────────────────────────────────────────────────────

function MissionCard({ mission }) {
  const color = TYPE_COLORS[mission.type] ?? { bg: "bg-gray-100", text: "text-gray-600" }
  const isUrgent = mission.urgency === "high"
  const budget = new Intl.NumberFormat("fr-FR").format(mission.budget)

  let deadlineLabel = null
  let deadlineIcon = <Calendar size={12} className="shrink-0" />
  if (isUrgent) {
    deadlineLabel = "Urgent"
    deadlineIcon = <Zap size={12} className="text-red-500 shrink-0" />
  } else if (mission.deadline) {
    const d = new Date(mission.deadline)
    const now = new Date()
    const diffDays = Math.ceil((d - now) / 86400000)
    if (diffDays === 0) deadlineLabel = "Aujourd'hui"
    else if (diffDays === 1) deadlineLabel = "Dès demain"
    else if (diffDays <= 7) deadlineLabel = `Sous ${diffDays} jours`
    else deadlineLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(d)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {/* Header */}
      <div className="px-5 pt-5 flex items-start justify-between gap-3">
        <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1.5 rounded-xl ${color.bg} ${color.text}`}>
          {mission.type}
        </span>
        <div className="text-right shrink-0">
          <span className="text-xl font-black text-[#1A6B4A] leading-none">
            {budget}
          </span>
          <span className="text-xs text-gray-400 font-medium block">FCFA</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-3 flex-1 flex flex-col gap-2">
        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
          {mission.title}
        </h3>
        {mission.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
            {mission.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-gray-400 gap-2">
          {mission.city && (
            <div className="flex items-center gap-1 min-w-0">
              <MapPin size={12} className="shrink-0 text-gray-400" />
              <span className="truncate">{mission.city}</span>
            </div>
          )}
          {deadlineLabel && (
            <div className={`flex items-center gap-1 shrink-0 font-semibold ${isUrgent ? "text-red-500" : "text-gray-500"}`}>
              {deadlineIcon}
              <span>{deadlineLabel}</span>
            </div>
          )}
        </div>

        <Link
          href={`/missions/${mission.id}`}
          className="block w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 text-center hover:border-[#1A6B4A] hover:text-[#1A6B4A] hover:bg-[#f0faf5] transition-colors touch-manipulation"
        >
          Voir les détails
        </Link>
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, buildHref }) {
  if (totalPages <= 1) return null

  function getPages() {
    const pages = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }
    pages.push(1)
    if (page > 3) pages.push("…")
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push("…")
    pages.push(totalPages)
    return pages
  }

  const btnBase = "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <Link
        href={page > 1 ? buildHref(page - 1) : "#"}
        className={`${btnBase} ${page <= 1 ? "opacity-30 pointer-events-none" : "text-gray-500 hover:bg-gray-100"}`}
      >
        <ChevronLeft size={16} />
      </Link>

      {getPages().map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-sm text-gray-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={`${btnBase} ${
              p === page
                ? "bg-[#1A6B4A] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={page < totalPages ? buildHref(page + 1) : "#"}
        className={`${btnBase} ${page >= totalPages ? "opacity-30 pointer-events-none" : "text-gray-500 hover:bg-gray-100"}`}
      >
        <ChevronRight size={16} />
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StudentMissionsPage({ searchParams }) {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const q         = searchParams?.q ?? ""
  const type      = searchParams?.type ?? ""
  const citiesStr = searchParams?.cities ?? ""
  const urgency   = searchParams?.urgency ?? ""
  const budgetMax = searchParams?.budget ?? ""
  const sort      = searchParams?.sort ?? "recent"
  const page      = Math.max(1, parseInt(searchParams?.page ?? "1") || 1)

  const selectedCities = citiesStr ? citiesStr.split(",").filter(Boolean) : []

  // Construction query
  let query = supabase
    .from("missions")
    .select("id, title, description, type, city, budget, urgency, deadline, created_at", { count: "exact" })
    .eq("status", "open")

  if (q)          query = query.ilike("title", `%${q}%`)
  if (type && type !== "all") query = query.eq("type", type)
  if (selectedCities.length === 1) query = query.eq("city", selectedCities[0])
  if (selectedCities.length > 1)  query = query.in("city", selectedCities)
  if (urgency)    query = query.eq("urgency", urgency)
  if (budgetMax)  query = query.lte("budget", parseInt(budgetMax))

  // Sort
  if (sort === "budget_asc")  query = query.order("budget", { ascending: true })
  else if (sort === "budget_desc") query = query.order("budget", { ascending: false })
  else                              query = query.order("created_at", { ascending: false })

  const from = (page - 1) * PAGE_SIZE
  query = query.range(from, from + PAGE_SIZE - 1)

  const { data: missions, count } = await query

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function buildHref(p) {
    const params = new URLSearchParams()
    if (q)         params.set("q", q)
    if (type)      params.set("type", type)
    if (citiesStr) params.set("cities", citiesStr)
    if (urgency)   params.set("urgency", urgency)
    if (budgetMax) params.set("budget", budgetMax)
    if (sort)      params.set("sort", sort)
    if (p > 1)     params.set("page", String(p))
    const qs = params.toString()
    return `/student/missions${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Chips catégories ──────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {[{ label: "Toutes les missions", value: "" }, ...MISSION_TYPES.map((t) => ({ label: t, value: t }))].map(({ label, value }) => {
            const isActive = type === value
            return (
              <Link
                key={label}
                href={buildHref(1).replace(
                  type ? `type=${encodeURIComponent(type)}` : "",
                  value ? `type=${encodeURIComponent(value)}` : ""
                ).replace(/[?&]$/, "") || (value ? `/student/missions?type=${encodeURIComponent(value)}` : "/student/missions")}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap touch-manipulation ${
                  isActive
                    ? "bg-[#1A6B4A] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Corps : sidebar gauche + grille ──────────────────────── */}
      <div className="flex flex-1 gap-6 p-6 max-w-[1280px] w-full mx-auto">

        {/* Sidebar filtres */}
        <Suspense fallback={null}>
          <MissionsFiltersSidebar
            budgetMax={budgetMax}
            cities={selectedCities}
            urgency={urgency}
          />
        </Suspense>

        {/* Contenu principal */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* Titre + tri */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-gray-900">Missions disponibles</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {count ?? 0} mission{(count ?? 0) !== 1 ? "s" : ""} correspondent à vos critères
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 text-sm text-gray-500 font-medium">
              Trier par :
              <Suspense fallback={null}>
                <SortSelect sort={sort} />
              </Suspense>
            </div>
          </div>

          {/* Grille missions */}
          {!missions?.length ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <MapPin size={24} className="text-gray-300" />
              </div>
              <p className="text-base font-semibold text-gray-700 mb-1">Aucune mission trouvée</p>
              <p className="text-sm text-gray-400">Modifiez vos filtres pour voir plus de résultats.</p>
              <Link href="/missions" className="mt-4 text-sm font-semibold text-[#1A6B4A] hover:underline">
                Réinitialiser les filtres
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {missions.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
                ))}
              </div>

              <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
