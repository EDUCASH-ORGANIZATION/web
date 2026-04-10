import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { ChevronLeft, ChevronRight, ShieldCheck, Users, UserX } from "lucide-react"
import { SuspendButton } from "@/components/admin/suspend-button"

export const metadata = { title: "Utilisateurs — Admin EduCash" }

const PAGE_SIZE = 20

const ROLE_CONFIG = {
  admin:   { label: "Admin",    cls: "bg-purple-100 text-purple-700" },
  client:  { label: "Client",   cls: "bg-blue-100 text-blue-700"    },
  student: { label: "Étudiant", cls: "bg-green-100 text-green-700"  },
}

export default async function AdminUsersPage({ searchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") redirect("/auth/login")

  // ── Fix Next.js 16 : await searchParams ───────────────────────
  const { page: pageParam, role: roleFilter } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10))
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  let query = supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, role, is_verified, is_suspended, missions_done, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (roleFilter && ["student", "client", "admin"].includes(roleFilter)) {
    query = query.eq("role", roleFilter)
  }

  const { data: profiles, count } = await query

  // Emails via service role (en parallèle)
  const emailMap = {}
  await Promise.allSettled(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.user_id)
      if (data?.user?.email) emailMap[p.user_id] = data.user.email
    })
  )

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1

  // Counts par rôle pour les filtres
  const [{ count: studentCount }, { count: clientCount }, { count: suspendedCount }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "client"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_suspended", true),
  ])

  function buildHref(p, role) {
    const params = new URLSearchParams()
    if (role) params.set("role", role)
    if (p > 1) params.set("page", String(p))
    const qs = params.toString()
    return `/admin/users${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6 max-w-[1400px] mx-auto">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {count ?? 0} compte{(count ?? 0) !== 1 ? "s" : ""}
            {roleFilter ? ` · filtre : ${roleFilter}` : " au total"}
          </p>
        </div>
      </div>

      {/* ── Stats rapides ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Étudiants",  count: studentCount,   icon: Users,      bg: "bg-green-50",  color: "text-green-600"  },
          { label: "Clients",    count: clientCount,    icon: Users,      bg: "bg-blue-50",   color: "text-blue-600"   },
          { label: "Suspendus",  count: suspendedCount, icon: UserX,      bg: "bg-red-50",    color: "text-red-500"    },
          { label: "Total",      count: count,          icon: ShieldCheck, bg: "bg-gray-100", color: "text-gray-500"   },
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

      {/* ── Filtres rôle ──────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Tous",        value: ""        },
          { label: "Étudiants",   value: "student" },
          { label: "Clients",     value: "client"  },
          { label: "Admins",      value: "admin"   },
        ].map(({ label, value }) => {
          const isActive = (roleFilter ?? "") === value
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

      {/* ── Tableau ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Utilisateur", "Email", "Rôle", "Statut", "Missions", "Inscription", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(profiles ?? []).map((profile) => {
                const initial    = profile.full_name?.charAt(0)?.toUpperCase() ?? "?"
                const email      = emailMap[profile.user_id] ?? "—"
                const roleCfg    = ROLE_CONFIG[profile.role] ?? ROLE_CONFIG.student
                const date       = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(profile.created_at))

                return (
                  <tr
                    key={profile.user_id}
                    className={`hover:bg-gray-50 transition-colors ${profile.is_suspended ? "opacity-60" : ""}`}
                  >
                    {/* Utilisateur */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
                          {profile.avatar_url ? (
                            <Image src={profile.avatar_url} alt={profile.full_name ?? ""} fill sizes="36px" className="object-cover" />
                          ) : (
                            <span className="text-white text-xs font-black">{initial}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate max-w-[140px]">
                            {profile.full_name ?? "—"}
                          </p>
                          {profile.is_suspended && (
                            <p className="text-[10px] text-red-500 font-semibold">Suspendu</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-3.5 text-gray-500 text-xs truncate max-w-[180px]">{email}</td>

                    {/* Rôle */}
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${roleCfg.cls}`}>
                        {roleCfg.label}
                      </span>
                    </td>

                    {/* Vérification */}
                    <td className="px-5 py-3.5">
                      {profile.role === "student" ? (
                        profile.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700">
                            <ShieldCheck size={12} />
                            Vérifié
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            En attente
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-gray-300">—</span>
                      )}
                    </td>

                    {/* Missions */}
                    <td className="px-5 py-3.5 text-gray-600 font-semibold text-center">
                      {profile.missions_done ?? 0}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{date}</td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <SuspendButton
                        userId={profile.user_id}
                        name={profile.full_name ?? "Utilisateur"}
                        isSuspended={profile.is_suspended ?? false}
                      />
                    </td>
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
                href={page > 1 ? buildHref(page - 1, roleFilter) : "#"}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                  page <= 1
                    ? "border-gray-100 text-gray-300 pointer-events-none"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <ChevronLeft size={15} />
                Précédent
              </Link>
              <Link
                href={page < totalPages ? buildHref(page + 1, roleFilter) : "#"}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                  page >= totalPages
                    ? "border-gray-100 text-gray-300 pointer-events-none"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Suivant
                <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
