import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

export default async function AdminLayout({ children }) {
  // Autorité : profiles.role (user_metadata est modifiable par l'utilisateur)
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  // Compte des étudiants non vérifiés pour le badge sidebar (client service role après le contrôle admin)
  const { count: pendingCount } = await createServiceClient()
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "student")
    .eq("is_verified", false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar pendingCount={pendingCount ?? 0} />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
