import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Dashboard Admin — EduCash" }

function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") redirect("/auth/login")

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoIso = sevenDaysAgo.toISOString()

  const [
    { count: studentCount },
    { count: missionCount },
    { count: doneCount },
    { data: commissionData },
    { data: recentMissions },
    { data: pendingProfiles },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("missions").select("*", { count: "exact", head: true }),
    supabase.from("missions").select("*", { count: "exact", head: true }).eq("status", "done"),
    supabase.from("transactions").select("commission").eq("status", "paid"),
    supabase
      .from("missions")
      .select("id, title, created_at, status")
      .gte("created_at", sevenDaysAgoIso)
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, created_at")
      .eq("role", "student")
      .eq("is_verified", false)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const totalCommission = (commissionData ?? []).reduce((s, t) => s + (t.commission ?? 0), 0)
  const fmtCommission = new Intl.NumberFormat("fr-FR").format(Math.round(totalCommission))

  // Groupe les missions par jour sur 7 jours
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split("T")[0]
  })

  const byDay = {}
  ;(recentMissions ?? []).forEach((m) => {
    const day = m.created_at.split("T")[0]
    byDay[day] = (byDay[day] ?? 0) + 1
  })

  const weekRows = dayLabels.map((day, i) => {
    const count = byDay[day] ?? 0
    const prev = i > 0 ? (byDay[dayLabels[i - 1]] ?? 0) : null
    let evolution = "—"
    if (prev !== null) {
      const diff = count - prev
      evolution = diff > 0 ? `+${diff}` : diff === 0 ? "=" : `${diff}`
    }
    const label = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(day))
    return { label, count, evolution }
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord admin</h1>
        <p className="text-sm text-gray-500 mt-1">Vue d&apos;ensemble de la plateforme EduCash.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Étudiants inscrits" value={studentCount ?? 0} />
        <KpiCard label="Missions publiées" value={missionCount ?? 0} />
        <KpiCard label="Complétées" value={doneCount ?? 0} />
        <KpiCard label="Commissions" value={`${fmtCommission} FCFA`} sub="Total perçu" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Missions par semaine */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Missions — 7 derniers jours</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Jour</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Évolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {weekRows.map(({ label, count, evolution }) => (
                <tr key={label} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-gray-700 font-medium capitalize">{label}</td>
                  <td className="px-6 py-3 text-gray-900 font-semibold">{count}</td>
                  <td className="px-6 py-3">
                    <span className={
                      evolution.startsWith("+") ? "text-green-600 font-medium" :
                      evolution.startsWith("-") ? "text-red-500 font-medium" :
                      "text-gray-400"
                    }>
                      {evolution}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Vérifications en attente */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Vérifications en attente</p>
            {(pendingProfiles?.length ?? 0) > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingProfiles.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {!pendingProfiles?.length ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Aucune en attente.</p>
            ) : (
              pendingProfiles.map((p) => {
                const initial = p.full_name?.charAt(0)?.toUpperCase() ?? "?"
                const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(p.created_at))
                return (
                  <div key={p.user_id} className="flex items-center gap-3 px-5 py-3">
                    <div className="relative w-8 h-8 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
                      {p.avatar_url ? (
                        <Image src={p.avatar_url} alt={p.full_name} fill sizes="32px" className="object-cover" />
                      ) : (
                        <span className="text-white text-xs font-bold">{initial}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.full_name}</p>
                      <p className="text-xs text-gray-400">{date}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <Link
              href="/admin/verifications"
              className="text-sm font-medium text-[#1A6B4A] hover:underline"
            >
              Voir toutes →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
