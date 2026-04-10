import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  Briefcase, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight,
} from "lucide-react"

export const metadata = { title: "Missions — Admin EduCash" }

const PAGE_SIZE = 25

const STATUS_CONFIG = {
  open:        { label: "Ouverte",   cls: "bg-blue-100 text-blue-700",   dot: "bg-blue-400"  },
  in_progress: { label: "En cours",  cls: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  done:        { label: "Terminée",  cls: "bg-green-100 text-green-700", dot: "bg-green-400" },
  cancelled:   { label: "Annulée",   cls: "bg-gray-100 text-gray-500",   dot: "bg-gray-300"  },
}

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

export default async function AdminMissionsPage({ searchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") redirect("/auth/login")

  const { page: pageParam, status: statusFilter } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10))
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  let query = supabase
    .from("missions")
    .select("id, title, type, city, budget, status, urgency, created_at, client_id, profiles!client_id(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (statusFilter && ["open", "in_progress", "done", "cancelled"].includes(statusFilter)) {
    query = query.eq("status", statusFilter)
  }

  const { data: missions, count } = await query

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1

  // Counts par statut
  const [
    { count: openCount },
    { count: inProgressCount },
    { count: doneCount },
    { count: cancelledCount },
  ] = await Promise.all([
    supabase.from("missions").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("missions").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("missions").select("*", { count: "exact", head: true }).eq("status", "done"),
    supabase.from("missions").select("*", { count: "exact", head: true }).eq("status", "cancelled"),
  ])

  function buildHref(p, status) {
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    if (p > 1) params.set("page", String(p))
    const qs = params.toString()
    return `/admin/missions${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Missions</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {count ?? 0} mission{(count ?? 0) !== 1 ? "s" : ""}
          {statusFilter ? ` · filtre : ${STATUS_CONFIG[statusFilter]?.label ?? statusFilter}` : " au total"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Ouvertes",  count: openCount,       icon: Briefcase,   bg: "bg-blue-50",   color: "text-blue-600"  },
          { label: "En cours",  count: inProgressCount, icon: Clock,       bg: "bg-amber-50",  color: "text-amber-600" },
          { label: "Terminées", count: doneCount,       icon: CheckCircle, bg: "bg-green-50",  color: "text-green-600" },
          { label: "Annulées",  count: cancelledCount,  icon: XCircle,     bg: "bg-gray-100",  color: "text-gray-500"  },
        ].map(({ label, count: c, icon: Icon, bg, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900 leading-none">{c ?? 0}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Toutes",    value: ""            },
          { label: "Ouvertes",  value: "open"        },
          { label: "En cours",  value: "in_progress" },
          { label: "Terminées", value: "done"        },
          { label: "Annulées",  value: "cancelled"   },
        ].map(({ label, value }) => {
          const isActive = (statusFilter ?? "") === value
          return (
            <Link
              key={value}
              href={buildHref(1, value)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[#1A6B4A] text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Titre", "Type", "Client", "Budget", "Ville", "Statut", "Date"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(missions ?? []).map((mission) => {
                const status = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.open
                const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(mission.created_at))
                const clientName = mission.profiles?.full_name ?? "—"

                return (
                  <tr key={mission.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 max-w-[220px]">
                      <p className="font-semibold text-gray-900 truncate">{mission.title}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-gray-500">{mission.type}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-gray-600 truncate max-w-[120px] block">{clientName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-black text-[#1A6B4A]">{fmt(mission.budget)}</span>
                      <span className="text-[10px] text-gray-400 ml-1">FCFA</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{mission.city}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap">{date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page <span className="font-bold">{page}</span> sur {totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                href={page > 1 ? buildHref(page - 1, statusFilter) : "#"}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                  page <= 1 ? "border-gray-100 text-gray-300 pointer-events-none" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <ChevronLeft size={15} /> Précédent
              </Link>
              <Link
                href={page < totalPages ? buildHref(page + 1, statusFilter) : "#"}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                  page >= totalPages ? "border-gray-100 text-gray-300 pointer-events-none" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Suivant <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
