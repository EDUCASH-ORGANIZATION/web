import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { Badge } from "@/components/ui/badge"
import { SuspendButton } from "@/components/admin/suspend-button"

export const metadata = { title: "Utilisateurs — Admin EduCash" }

const PAGE_SIZE = 20

export default async function AdminUsersPage({ searchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") redirect("/auth/login")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: profiles, count } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, role, is_verified, is_suspended, missions_done, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  // Récupère les emails via service role
  const emailMap = {}
  await Promise.allSettled(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.user_id)
      if (data?.user?.email) emailMap[p.user_id] = data.user.email
    })
  )

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {count ?? 0} compte{count !== 1 ? "s" : ""} au total.
          </p>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Utilisateur</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Rôle</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Vérifié</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Missions</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(profiles ?? []).map((profile) => {
                const initial = profile.full_name?.charAt(0)?.toUpperCase() ?? "?"
                const date = new Intl.DateTimeFormat("fr-FR", {
                  day: "numeric", month: "short", year: "numeric",
                }).format(new Date(profile.created_at))
                const email = emailMap[profile.user_id] ?? "—"
                const profileHref = profile.role === "student"
                  ? `/students/${profile.user_id}`
                  : `/client/dashboard`

                return (
                  <tr key={profile.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
                          {profile.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-xs font-bold">{initial}</span>
                          )}
                        </div>
                        <span className="font-medium text-gray-900 truncate max-w-[140px]">
                          {profile.full_name ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-[180px]">{email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        profile.role === "admin" ? "bg-purple-100 text-purple-700" :
                        profile.role === "client" ? "bg-blue-100 text-blue-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {profile.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {profile.role === "student" ? (
                        profile.is_verified
                          ? <span className="text-xs font-medium text-green-700">✓ Oui</span>
                          : <span className="text-xs text-amber-600">En attente</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{profile.missions_done ?? 0}</td>
                    <td className="px-4 py-3 text-gray-400">{date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <SuspendButton
                          userId={profile.user_id}
                          name={profile.full_name ?? "Utilisateur"}
                          isSuspended={profile.is_suspended ?? false}
                        />
                        <Link
                          href={profileHref}
                          className="text-xs font-medium text-[#1A6B4A] hover:underline"
                        >
                          Voir profil
                        </Link>
                      </div>
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
              Page {page} sur {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/users?page=${page - 1}`}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/users?page=${page + 1}`}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Suivant →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
