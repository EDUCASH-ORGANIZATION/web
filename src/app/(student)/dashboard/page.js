import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Clock, CheckCircle, Wallet, Briefcase } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { MissionCard } from "@/components/shared/mission-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Card } from "@/components/ui/card"

export const metadata = { title: "Mon tableau de bord — EduCash" }

function formatMoney(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

const APPLICATION_STATUS_LABELS = {
  pending:  { label: "En attente",  className: "bg-amber-100 text-amber-700" },
  accepted: { label: "Acceptée",    className: "bg-green-100 text-green-700" },
  rejected: { label: "Refusée",     className: "bg-red-100 text-red-700" },
}

export default async function StudentDashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [
    { data: profile },
    { count: pendingCount },
    { data: earningsData },
    { data: nearbyMissions },
    { data: recentApplications },
  ] = await Promise.all([
    // 1. Profil complet
    supabase
      .from("profiles")
      .select("full_name, city, is_verified, missions_done")
      .eq("user_id", user.id)
      .single(),

    // 2. Candidatures en attente (COUNT)
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id)
      .eq("status", "pending"),

    // 3. Total gains (SUM via agrégation manuelle — Supabase ne supporte pas SUM direct)
    supabase
      .from("transactions")
      .select("amount_student")
      .eq("student_id", user.id)
      .eq("status", "paid"),

    // 4. 4 missions ouvertes dans la ville de l'étudiant
    // (requête différée après le profil — on utilise null comme fallback)
    supabase
      .from("missions")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(4),

    // 5. 3 dernières candidatures avec titre de mission joint
    supabase
      .from("applications")
      .select("id, status, created_at, missions(id, title)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ])

  // Filtre missions par ville côté JS (évite une requête séquentielle)
  const city = profile?.city
  const cityMissions = city
    ? (nearbyMissions ?? []).filter((m) => m.city === city).slice(0, 4)
    : []

  const firstName = profile?.full_name?.split(" ")[0] ?? "toi"
  const totalEarned = (earningsData ?? []).reduce((sum, t) => sum + (t.amount_student ?? 0), 0)

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor(diff / 3600000)
    if (days > 0) return `il y a ${days}j`
    if (hours > 0) return `il y a ${hours}h`
    return "à l'instant"
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto lg:max-w-3xl flex flex-col gap-6">

      {/* ── Salutation ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bonjour, {firstName} 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Voici un aperçu de ton activité sur EduCash.</p>
      </div>

      {/* ── Banner vérification en attente ─────────────────────────── */}
      {profile?.is_verified === false && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Profil en cours de vérification</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              Nous vérifions ta carte étudiante. Cela prend généralement moins de 24h.
              Tu pourras postuler aux missions une fois vérifié.
            </p>
          </div>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock size={15} className="text-[#1A6B4A]" />
            <span className="text-xs text-gray-500">En attente</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingCount ?? 0}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">candidatures</p>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle size={15} className="text-[#1A6B4A]" />
            <span className="text-xs text-gray-500">Réalisées</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{profile?.missions_done ?? 0}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">missions</p>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet size={15} className="text-[#1A6B4A]" />
            <span className="text-xs text-gray-500">Gagnés</span>
          </div>
          <p className="text-xl font-bold text-gray-900 leading-tight">{formatMoney(totalEarned)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">FCFA</p>
        </Card>
      </div>

      {/* ── Missions recommandées ───────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Missions près de toi {city ? `· ${city}` : ""}
          </h2>
          <Link href="/missions" className="text-sm text-[#1A6B4A] hover:underline">
            Voir tout →
          </Link>
        </div>

        {cityMissions.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Aucune mission dans ta ville"
            message="Consulte toutes les missions disponibles au Bénin."
            ctaLabel="Explorer les missions"
            ctaHref="/missions"
          />
        ) : (
          <div className="flex overflow-x-auto gap-4 pb-2 -mx-4 px-4">
            {cityMissions.map((mission) => (
              <Link
                key={mission.id}
                href={`/missions/${mission.id}`}
                className="shrink-0 w-72"
              >
                <MissionCard mission={mission} showApplyButton={false} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Dernières candidatures ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Mes candidatures récentes</h2>
          <Link href="/applications" className="text-sm text-[#1A6B4A] hover:underline">
            Voir tout →
          </Link>
        </div>

        {!recentApplications?.length ? (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <p className="text-sm text-gray-500">Tu n&apos;as pas encore postulé à une mission.</p>
            <Link href="/missions" className="text-sm text-[#1A6B4A] font-medium hover:underline mt-1 inline-block">
              Explorer les missions →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentApplications.map((app) => {
              const status = APPLICATION_STATUS_LABELS[app.status] ?? APPLICATION_STATUS_LABELS.pending
              return (
                <Link
                  key={app.id}
                  href={`/missions/${app.missions?.id}`}
                  className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {app.missions?.title ?? "Mission supprimée"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(app.created_at)}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
