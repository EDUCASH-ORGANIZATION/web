import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Users, Briefcase, CheckCircle, TrendingUp,
  ShieldAlert, ShieldCheck, ArrowRight, Clock,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Dashboard — Admin EduCash" }

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso))
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, bg }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={22} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-gray-900 mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Bar Chart (CSS) ──────────────────────────────────────────────────────────

function BarChart({ rows }) {
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <div className="flex items-end gap-2 h-28 mt-4">
      {rows.map(({ label, count }) => {
        const pct = Math.max((count / max) * 100, count > 0 ? 8 : 2)
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-black text-gray-500">{count > 0 ? count : ""}</span>
            <div
              className="w-full rounded-t-lg bg-[#1A6B4A] transition-all"
              style={{ height: `${pct}%`, minHeight: count > 0 ? "8px" : "2px", opacity: count === 0 ? 0.15 : 1 }}
            />
            <span className="text-[9px] text-gray-400 font-medium text-center leading-tight capitalize">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") redirect("/auth/login")

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoIso = sevenDaysAgo.toISOString()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { count: studentCount },
    { count: clientCount },
    { count: missionCount },
    { count: openCount },
    { count: doneCount },
    { count: pendingCount },
    { data: commissionData },
    { data: recentMissions },
    { data: pendingProfiles },
    { data: recentUsers },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "client"),
    supabase.from("missions").select("*", { count: "exact", head: true }),
    supabase.from("missions").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("missions").select("*", { count: "exact", head: true }).eq("status", "done"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student").eq("is_verified", false),
    supabase.from("transactions").select("commission").eq("status", "paid"),
    supabase.from("missions").select("id, title, created_at, status").gte("created_at", sevenDaysAgoIso).order("created_at", { ascending: true }),
    supabase.from("profiles").select("user_id, full_name, avatar_url, created_at").eq("role", "student").eq("is_verified", false).order("created_at", { ascending: false }).limit(5),
    supabase.from("profiles").select("user_id, full_name, role, created_at").order("created_at", { ascending: false }).limit(8),
  ])

  const totalCommission = (commissionData ?? []).reduce((s, t) => s + (t.commission ?? 0), 0)

  // Missions par jour sur 7 jours
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

  const chartRows = dayLabels.map((day) => ({
    label: new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(new Date(day)),
    count: byDay[day] ?? 0,
  }))

  const weekTotal = chartRows.reduce((s, r) => s + r.count, 0)

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-8 max-w-[1400px] mx-auto">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue d&apos;ensemble de la plateforme EduCash</p>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Étudiants"
          value={fmt(studentCount)}
          sub={`${pendingCount ?? 0} en attente de vérif.`}
          icon={Users}
          color="text-[#1A6B4A]"
          bg="bg-[#f0faf5]"
        />
        <KpiCard
          label="Clients"
          value={fmt(clientCount)}
          sub="Donneurs d'ordre"
          icon={Briefcase}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          label="Missions totales"
          value={fmt(missionCount)}
          sub={`${openCount ?? 0} ouvertes · ${doneCount ?? 0} terminées`}
          icon={CheckCircle}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <KpiCard
          label="Commissions perçues"
          value={`${fmt(Math.round(totalCommission))} FCFA`}
          sub="Total cumulé"
          icon={TrendingUp}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      {/* ── Alerte vérifications ──────────────────────────────────── */}
      {(pendingCount ?? 0) > 0 && (
        <Link
          href="/admin/verifications"
          className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 hover:bg-amber-100 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-amber-900">
              {pendingCount} dossier{pendingCount !== 1 ? "s" : ""} en attente de vérification
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Des étudiants attendent la validation de leur carte.
            </p>
          </div>
          <ArrowRight size={18} className="text-amber-500 group-hover:translate-x-1 transition-transform shrink-0" />
        </Link>
      )}

      {/* ── Graphique + colonnes latérales ────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Missions 7 jours — bar chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-sm font-black text-gray-900">Missions publiées</h2>
              <p className="text-xs text-gray-400 mt-0.5">7 derniers jours</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-gray-900 leading-none">{weekTotal}</p>
              <p className="text-xs text-gray-400 mt-0.5">cette semaine</p>
            </div>
          </div>
          <BarChart rows={chartRows} />
        </div>

        {/* Vérifications en attente */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-900">Vérifications en attente</h2>
            {(pendingCount ?? 0) > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </div>

          <div className="flex flex-col divide-y divide-gray-50">
            {!pendingProfiles?.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                <ShieldCheck size={32} className="text-green-300" />
                <p className="text-sm font-semibold text-gray-500">Tout est à jour</p>
                <p className="text-xs text-gray-400">Aucune vérification en attente.</p>
              </div>
            ) : (
              pendingProfiles.map((p) => {
                const initial = p.full_name?.charAt(0)?.toUpperCase() ?? "?"
                return (
                  <div key={p.user_id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="relative w-9 h-9 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
                      {p.avatar_url ? (
                        <Image src={p.avatar_url} alt={p.full_name} fill sizes="36px" className="object-cover" />
                      ) : (
                        <span className="text-white text-xs font-black">{initial}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">Étudiant non vérifié</p>
                    </div>
                    <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400" />
                  </div>
                )
              })
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100">
            <Link
              href="/admin/verifications"
              className="text-sm font-bold text-[#1A6B4A] hover:underline flex items-center gap-1"
            >
              Gérer les vérifications
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Derniers inscrits ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900">Derniers inscrits</h2>
          <Link href="/admin/users" className="text-sm font-semibold text-[#1A6B4A] hover:underline flex items-center gap-1">
            Voir tout <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Utilisateur", "Rôle", "Inscription"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(recentUsers ?? []).map((u) => {
                const initial = u.full_name?.charAt(0)?.toUpperCase() ?? "?"
                return (
                  <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-black">{initial}</span>
                        </div>
                        <span className="font-semibold text-gray-900 truncate max-w-[160px]">
                          {u.full_name ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
                        u.role === "admin"   ? "bg-purple-100 text-purple-700" :
                        u.role === "client"  ? "bg-blue-100 text-blue-700"    :
                                              "bg-green-100 text-green-700"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-400 text-xs flex items-center gap-1.5">
                      <Clock size={12} />
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
