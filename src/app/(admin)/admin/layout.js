import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

export default async function AdminLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== "admin") {
    redirect("/auth/login")
  }

  // Compte des étudiants non vérifiés pour le badge sidebar
  const { count: pendingCount } = await supabase
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
