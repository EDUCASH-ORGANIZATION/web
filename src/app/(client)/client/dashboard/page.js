import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Briefcase, Clock, CheckCircle, Wallet, Plus, Users, ChevronRight,
} from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

export const metadata = { title: "Espace client — EduCash" }

function formatMoney(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  if (days > 0) return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  return "à l'instant"
}

export default async function ClientDashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [
    { data: profile },
    { count: activeMissionsCount },
    { count: doneCount },
    { data: paidTransactions },
    { data: recentMissions },
    { data: pendingApplicationsMissions },
  ] = await Promise.all([
    // 1. Profil client
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single(),

    // 2. COUNT missions actives (open + in_progress)
    supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", user.id)
      .in("status", ["open", "in_progress"]),

    // 3. COUNT missions terminées
    supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", user.id)
      .eq("status", "done"),

    // 4. SUM total dépensé (amount_total côté client)
    supabase
      .from("transactions")
      .select("amount_total")
      .eq("client_id", user.id)
      .eq("status", "paid"),

    // 5. 5 missions récentes avec candidatures jointes
    supabase
      .from("missions")
      .select("id, title, type, status, created_at, applications(id, status)")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),

    // 6. Missions avec au moins une candidature pending (pour "À traiter")
    supabase
      .from("missions")
      .select("id, title, applications!inner(id, status)")
      .eq("client_id", user.id)
      .eq("applications.status", "pending")
      .in("status", ["open", "in_progress"])
      .limit(5),
  ])

  const firstName = profile?.full_name?.split(" ")[0] ?? "vous"
  const totalSpent = (paidTransactions ?? []).reduce((sum, t) => sum + (t.amount_total ?? 0), 0)

  // Candidatures pending sur toutes les missions récentes
  const totalPendingApplications = (recentMissions ?? []).reduce((sum, m) => {
    return sum + (m.applications ?? []).filter((a) => a.status === "pending").length
  }, 0)

  // Enrichit les missions récentes avec leur count de candidatures
  const missionsWithCounts = (recentMissions ?? []).map((m) => ({
    ...m,
    applicationCount: m.applications?.length ?? 0,
    pendingCount: (m.applications ?? []).filter((a) => a.status === "pending").length,
  }))

  // Missions "À traiter" : group par mission avec count pending
  const toHandle = (pendingApplicationsMissions ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    pendingCount: (m.applications ?? []).filter((a) => a.status === "pending").length,
  })).filter((m) => m.pendingCount > 0)

  const STATS = [
    {
      label: "Missions actives",
      value: activeMissionsCount ?? 0,
      icon: Briefcase,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Candidatures en attente",
      value: totalPendingApplications,
      icon: Users,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      label: "Terminées",
      value: doneCount ?? 0,
      icon: CheckCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      label: "Total dépensé",
      value: formatMoney(totalSpent),
      unit: "FCFA",
      icon: Wallet,
      color: "text-[#1A6B4A]",
      bg: "bg-[#f0faf5]",
    },
  ]

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto flex flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonjour, {firstName} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez vos missions et trouvez les bons profils.</p>
        </div>
        {/* Bouton desktop */}
        <Link
          href="/client/missions/new"
          className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] transition-colors touch-manipulation"
        >
          <Plus size={16} />
          Poster une mission
        </Link>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map(({ label, value, unit, icon: Icon, color, bg }) => (
          <Card key={label} padding="sm">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon size={16} className={color} />
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-tight">
              {value}
              {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
            </p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* ── Corps principal : 2 colonnes sur desktop ────────────────── */}
      <div className="flex flex-col md:flex-row gap-6">

        {/* Colonne principale : missions récentes */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Mes missions récentes</h2>
            <Link href="/client/missions" className="text-sm text-[#1A6B4A] hover:underline">
              Voir tout →
            </Link>
          </div>

          {!missionsWithCounts.length ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <Briefcase size={32} className="text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-gray-500">Aucune mission publiée pour l&apos;instant.</p>
              <Link href="/client/missions/new" className="text-sm text-[#1A6B4A] font-medium hover:underline mt-1 inline-block">
                Publier votre première mission →
              </Link>
            </div>
          ) : (
            <>
              {/* Tableau desktop */}
              <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Titre</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Candidatures</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {missionsWithCounts.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 truncate max-w-[180px]">{m.title}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{m.type}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                            <Users size={13} className="text-gray-400" />
                            {m.applicationCount}
                            {m.pendingCount > 0 && (
                              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                                +{m.pendingCount}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={m.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(m.created_at)}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/client/missions/${m.id}`}
                            className="text-xs font-medium text-[#1A6B4A] hover:underline"
                          >
                            Gérer
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards mobile */}
              <div className="md:hidden flex flex-col gap-3">
                {missionsWithCounts.map((m) => (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-100 px-4 py-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 leading-snug flex-1">{m.title}</p>
                      <Badge status={m.status} />
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {m.applicationCount} candidature{m.applicationCount !== 1 ? "s" : ""}
                        {m.pendingCount > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                            {m.pendingCount} en attente
                          </span>
                        )}
                      </span>
                      <span className="text-gray-400 text-xs">{timeAgo(m.created_at)}</span>
                    </div>
                    <Link
                      href={`/client/missions/${m.id}`}
                      className="text-sm font-semibold text-[#1A6B4A] hover:underline self-start"
                    >
                      Gérer →
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Colonne droite : À traiter */}
        <div className="md:w-72 shrink-0 flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-900">À traiter</h2>

          {!toHandle.length ? (
            <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
              <CheckCircle size={24} className="text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-gray-500">Aucune candidature en attente.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {toHandle.map((m) => (
                <Link
                  key={m.id}
                  href={`/client/missions/${m.id}`}
                  className="flex items-center gap-3 bg-white rounded-xl border border-amber-100 px-4 py-3 hover:shadow-sm transition-shadow group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-amber-600 mt-0.5 font-medium">
                      {m.pendingCount} candidature{m.pendingCount > 1 ? "s" : ""} en attente
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-gray-400 group-hover:text-[#1A6B4A] transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FAB mobile ─────────────────────────────────────────────── */}
      <Link
        href="/client/missions/new"
        className="md:hidden fixed bottom-20 right-4 z-10 w-14 h-14 rounded-full bg-[#1A6B4A] text-white shadow-lg flex items-center justify-center hover:bg-[#155a3d] active:bg-[#104530] transition-colors touch-manipulation"
        aria-label="Poster une mission"
      >
        <Plus size={24} />
      </Link>
    </div>
  )
}
