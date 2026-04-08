import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { MapPin, Hourglass, CheckCircle2, Wallet, ShieldAlert, ArrowRight } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Dashboard — EduCash" }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d >= 1) return `il y a ${d}j`
  if (h >= 1) return `il y a ${h}h`
  return "à l'instant"
}

const TYPE_COLORS = {
  "Babysitting":            { bg: "bg-purple-50",  text: "text-purple-700" },
  "Livraison":              { bg: "bg-blue-50",    text: "text-blue-700" },
  "Aide administrative":    { bg: "bg-teal-50",    text: "text-teal-700" },
  "Saisie":                 { bg: "bg-indigo-50",  text: "text-indigo-700" },
  "Community Management":   { bg: "bg-pink-50",    text: "text-pink-700" },
  "Traduction":             { bg: "bg-cyan-50",    text: "text-cyan-700" },
  "Cours particuliers":     { bg: "bg-green-50",   text: "text-green-700" },
  "Autre":                  { bg: "bg-gray-100",   text: "text-gray-600" },
}

// ─── Mission card (design image) ──────────────────────────────────────────────

function DashboardMissionCard({ mission }) {
  const color = TYPE_COLORS[mission.type] ?? { bg: "bg-gray-100", text: "text-gray-600" }
  const budget = fmt(mission.budget)
  const isUrgent = mission.urgency === "high"

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      {/* Badges */}
      <div className="px-4 pt-4 flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg ${color.bg} ${color.text}`}>
          {isUrgent ? "Urgent" : mission.type}
        </span>
        <span className="text-[13px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg whitespace-nowrap">
          {budget} FCFA
        </span>
      </div>

      {/* Contenu */}
      <div className="px-4 py-3 flex-1 flex flex-col gap-1.5">
        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
          {mission.title}
        </h3>
        {mission.city && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <MapPin size={11} strokeWidth={2} />
            <span>{mission.city}</span>
          </div>
        )}
        {mission.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mt-0.5">
            {mission.description}
          </p>
        )}
      </div>

      {/* Bouton */}
      <div className="px-4 pb-4 mt-auto">
        <Link
          href={`/missions/${mission.id}`}
          className="block w-full py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 text-center hover:border-[#1A6B4A] hover:text-[#1A6B4A] hover:bg-[#f0faf5] transition-colors touch-manipulation"
        >
          Voir
        </Link>
      </div>
    </div>
  )
}

// ─── Activity item ─────────────────────────────────────────────────────────────

const APP_STATUS_ACTIVITY = {
  pending:  { dot: "bg-amber-400",  text: (title) => `Candidature envoyée pour "${title}".` },
  accepted: { dot: "bg-green-500",  text: (title) => `Ta candidature pour "${title}" a été acceptée !` },
  rejected: { dot: "bg-gray-300",   text: (title) => `Candidature non retenue pour "${title}".` },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StudentDashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [
    { data: profile },
    { count: pendingCount },
    { data: earningsData },
    { data: allMissions },
    { data: recentApplications },
    { data: recentMessages },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, city, is_verified, missions_done")
      .eq("user_id", user.id)
      .single(),

    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id)
      .eq("status", "pending"),

    supabase
      .from("transactions")
      .select("amount_student")
      .eq("student_id", user.id)
      .eq("status", "paid"),

    supabase
      .from("missions")
      .select("id, title, type, city, budget, description, urgency, status")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(8),

    supabase
      .from("applications")
      .select("id, status, created_at, missions(id, title)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4),

    supabase
      .from("messages")
      .select("id, content, created_at, read, sender_id, mission_id, profiles!sender_id(full_name, avatar_url)")
      .eq("receiver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ])

  // Trie les missions : ville de l'étudiant en priorité, puis le reste
  const city = profile?.city
  const sortedMissions = [...(allMissions ?? [])].sort((a, b) => {
    if (city) {
      if (a.city === city && b.city !== city) return -1
      if (b.city === city && a.city !== city) return 1
    }
    return 0
  }).slice(0, 4)

  // Déduplique les messages par sender
  const seenSenders = new Set()
  const uniqueMessages = (recentMessages ?? []).filter((m) => {
    if (seenSenders.has(m.sender_id)) return false
    seenSenders.add(m.sender_id)
    return true
  }).slice(0, 2)

  const unreadCount = (recentMessages ?? []).filter((m) => !m.read).length

  const firstName = profile?.full_name?.split(" ")[0] ?? ""
  const totalEarned = (earningsData ?? []).reduce((s, t) => s + (t.amount_student ?? 0), 0)
  const missionsDone = profile?.missions_done ?? 0

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto flex flex-col gap-6">

      {/* ── En-tête page ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">
            Bienvenue, {firstName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Voici un aperçu de vos opportunités académiques aujourd&apos;hui.
          </p>
        </div>
        <Link
          href="/student/missions"
          className="shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] transition-colors touch-manipulation"
        >
          Nouvelle recherche
        </Link>
      </div>

      {/* ── Banner vérification ─────────────────────────────────────── */}
      {profile?.is_verified === false && (
        <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Vérification du profil en cours</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Complétez votre relevé de notes pour augmenter vos chances de sélection de 40%.
            </p>
          </div>
          <Link
            href="/profile"
            className="shrink-0 px-4 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-amber-800 hover:bg-amber-50 transition-colors touch-manipulation whitespace-nowrap"
          >
            Finaliser mon dossier
          </Link>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* En attente */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Hourglass size={18} className="text-purple-600" />
            </div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">En attente</span>
          </div>
          <div>
            <p className="text-3xl font-black text-gray-900">{pendingCount ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Candidatures actives</p>
          </div>
        </div>

        {/* Missions validées */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-[#1A6B4A]" />
            </div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Validées</span>
          </div>
          <div>
            <p className="text-3xl font-black text-gray-900">{missionsDone}</p>
            <p className="text-xs text-gray-400 mt-0.5">Missions complétées</p>
          </div>
        </div>

        {/* Total revenus */}
        <div className="bg-[#1A6B4A] rounded-2xl shadow-sm px-6 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Wallet size={18} className="text-white" />
            </div>
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-widest">Total revenus</span>
          </div>
          <div>
            <p className="text-3xl font-black text-white">
              {fmt(totalEarned)}
              <span className="text-base font-bold ml-1">FCFA</span>
            </p>
            <p className="text-xs text-white/60 mt-0.5">Gagnés ce mois-ci</p>
          </div>
        </div>
      </div>

      {/* ── Corps principal : missions + activité ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Missions recommandées (2/3) ──────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Missions recommandées</h2>
            <Link href="/student/missions" className="text-sm font-semibold text-[#1A6B4A] hover:underline flex items-center gap-1">
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>

          {sortedMissions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-sm text-gray-400">Aucune mission disponible pour le moment.</p>
              <Link href="/student/missions" className="text-sm font-semibold text-[#1A6B4A] hover:underline mt-2 inline-block">
                Explorer toutes les missions →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sortedMissions.map((mission) => (
                <DashboardMissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          )}
        </div>

        {/* ── Colonne droite : activité + messages ─────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Activité récente */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Activité récente</h2>

            {!recentApplications?.length ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune activité récente.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recentApplications.map((app) => {
                  const config = APP_STATUS_ACTIVITY[app.status] ?? APP_STATUS_ACTIVITY.pending
                  const title = app.missions?.title ?? "Mission"
                  return (
                    <li key={app.id} className="flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${config.dot}`} />
                      <div>
                        <p className="text-sm text-gray-700 leading-snug">
                          {config.text(title)}
                        </p>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">
                          {timeAgo(app.created_at)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Messages</h2>
              {unreadCount > 0 && (
                <span className="bg-[#1A6B4A] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                  {unreadCount} nouveau{unreadCount > 1 ? "x" : ""}
                </span>
              )}
            </div>

            {uniqueMessages.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucun message reçu.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {uniqueMessages.map((msg) => {
                  const sender = msg.profiles
                  const initial = sender?.full_name?.charAt(0)?.toUpperCase() ?? "?"
                  return (
                    <Link
                      key={msg.id}
                      href={`/messages/${msg.mission_id}`}
                      className="flex items-center gap-3 hover:bg-gray-50 rounded-xl p-2 -mx-2 transition-colors"
                    >
                      <div className="relative w-9 h-9 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
                        {sender?.avatar_url ? (
                          <Image src={sender.avatar_url} alt={sender.full_name} fill className="object-cover" />
                        ) : (
                          <span className="text-white text-xs font-bold">{initial}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {sender?.full_name ?? "Client"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{msg.content}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            <Link
              href="/messages"
              className="mt-4 block text-center text-sm font-semibold text-[#1A6B4A] hover:underline"
            >
              Accéder à la messagerie
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
