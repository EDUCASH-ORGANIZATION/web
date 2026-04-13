import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  MapPin, Pencil, Briefcase, CheckCircle, Wallet,
  Building2, Phone, Star, MessageSquare, Clock, LogOut,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, logout } from "@/lib/actions/auth.actions"

export const metadata = { title: "Mon profil — EduCash" }

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso))
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  if (days > 0) return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  return "à l'instant"
}

const STATUS_MAP = {
  open:        { label: "Ouverte",      cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "En cours",     cls: "bg-amber-100 text-amber-700" },
  done:        { label: "Terminée",     cls: "bg-green-100 text-green-700" },
  cancelled:   { label: "Annulée",      cls: "bg-gray-100 text-gray-500" },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [
    { data: profile },
    { data: missions },
    { data: transactions },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),

    supabase
      .from("missions")
      .select("id, title, type, status, budget, created_at")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("transactions")
      .select("amount")
      .eq("client_id", user.id)
      .eq("status", "paid"),
  ])

  const totalSpent    = (transactions ?? []).reduce((s, t) => s + (t.amount ?? 0), 0)
  const activeMissions  = (missions ?? []).filter((m) => ["open", "in_progress"].includes(m.status)).length
  const doneMissions    = (missions ?? []).filter((m) => m.status === "done").length
  const initial         = profile?.full_name?.charAt(0)?.toUpperCase() ?? "?"
  const companyName     = profile?.bio ?? null

  return (
    <div className="p-6 lg:p-8 max-w-[1000px] mx-auto flex flex-col gap-6">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

          {/* Avatar */}
          <div className="relative w-24 h-24 rounded-2xl bg-[#1A6B4A] flex items-center justify-center overflow-hidden shrink-0">
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name ?? ""}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <span className="text-white text-3xl font-black">{initial}</span>
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-black text-gray-900">{profile?.full_name}</h1>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {companyName && (
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <Building2 size={13} className="text-gray-400" />
                      {companyName}
                    </span>
                  )}
                  {profile?.city && (
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin size={13} className="text-gray-400" />
                      {profile.city}, Bénin
                    </span>
                  )}
                </div>
              </div>

              <Link
                href="/client/profile/edit"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors touch-manipulation shrink-0"
              >
                <Pencil size={14} />
                Modifier mon profil
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mt-1 flex-wrap">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Missions actives</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Briefcase size={16} className="text-[#1A6B4A]" />
                  <span className="text-xl font-black text-gray-900">{activeMissions}</span>
                </div>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Missions terminées</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CheckCircle size={16} className="text-[#1A6B4A]" />
                  <span className="text-xl font-black text-gray-900">{doneMissions}</span>
                </div>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total dépensé</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Wallet size={16} className="text-[#1A6B4A]" />
                  <p className="text-xl font-black text-gray-900">
                    {fmt(totalSpent)} <span className="text-sm font-bold text-gray-400">FCFA</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Corps : 2 colonnes ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Colonne gauche : infos */}
        <div className="flex flex-col gap-5">

          {/* Informations */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
            <h2 className="text-base font-black text-gray-900">Informations</h2>

            <div className="flex flex-col gap-3">
              {companyName && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#f0faf5] flex items-center justify-center shrink-0">
                    <Building2 size={15} className="text-[#1A6B4A]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entreprise / Structure</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{companyName}</p>
                  </div>
                </div>
              )}

              {profile?.city && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#f0faf5] flex items-center justify-center shrink-0">
                    <MapPin size={15} className="text-[#1A6B4A]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ville</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{profile.city}</p>
                  </div>
                </div>
              )}

              {profile?.phone && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#f0faf5] flex items-center justify-center shrink-0">
                    <Phone size={15} className="text-[#1A6B4A]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Téléphone</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{profile.phone}</p>
                  </div>
                </div>
              )}

              {profile?.created_at && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#f0faf5] flex items-center justify-center shrink-0">
                    <Clock size={15} className="text-[#1A6B4A]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Membre depuis</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatDate(profile.created_at)}</p>
                  </div>
                </div>
              )}
            </div>

            {!companyName && !profile?.phone && (
              <Link
                href="/client/profile/edit"
                className="text-sm font-semibold text-[#1A6B4A] hover:underline"
              >
                Compléter mon profil →
              </Link>
            )}
          </div>

          {/* Publier une mission */}
          <Link
            href="/client/missions/new"
            className="bg-[#1A6B4A] rounded-2xl p-5 flex flex-col gap-3 hover:bg-[#155a3d] transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Star size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Publier une nouvelle mission</p>
              <p className="text-xs text-white/70 mt-0.5">Trouvez l&apos;étudiant idéal en quelques minutes</p>
            </div>
          </Link>
        </div>

        {/* Colonne droite : missions récentes */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black text-gray-900">
              <Briefcase size={17} className="text-[#1A6B4A]" />
              Mes dernières missions
            </h2>
            <Link
              href="/client/missions"
              className="text-sm font-semibold text-[#1A6B4A] hover:underline"
            >
              Voir tout →
            </Link>
          </div>

          {!missions?.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Briefcase size={24} className="text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Aucune mission publiée</p>
                <p className="text-xs text-gray-400 mt-1">Publiez votre première mission pour trouver des étudiants.</p>
              </div>
              <Link
                href="/client/missions/new"
                className="mt-1 px-5 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors"
              >
                Créer une mission
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {missions.map((mission) => {
                const status = STATUS_MAP[mission.status] ?? STATUS_MAP.open
                return (
                  <Link
                    key={mission.id}
                    href={`/client/missions/${mission.id}`}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{mission.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400">{timeAgo(mission.created_at)}</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-xs font-semibold text-[#1A6B4A]">
                          {fmt(mission.budget)} FCFA
                        </span>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
                      {status.label}
                    </span>
                  </Link>
                )
              })}

              <Link
                href="/client/missions"
                className="text-center text-sm font-semibold text-[#1A6B4A] hover:underline py-2"
              >
                Voir toutes mes missions
              </Link>
            </div>
          )}
        </div>

        {/* ── Déconnexion (mobile uniquement) ───────────────────────── */}
        <div className="lg:hidden mt-2 mb-6">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors touch-manipulation"
            >
              <LogOut size={16} strokeWidth={1.75} />
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
