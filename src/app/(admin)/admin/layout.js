import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { BottomNav } from "@/components/app-shell/bottom-nav"
import { ADMIN_MOBILE_NAV } from "@/components/admin/admin-nav"

export default async function AdminLayout({ children }) {
  // Autorité : profiles.role (user_metadata est modifiable par l'utilisateur)
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  // Compte des étudiants non vérifiés pour le badge de la barre latérale et de la barre mobile (client service role après le contrôle admin)
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
        <BottomNav
          items={ADMIN_MOBILE_NAV.mobile}
          more={ADMIN_MOBILE_NAV.mobileMore}
          counts={{ verifications: pendingCount ?? 0 }}
          reserveSpace
        />
      </main>
    </div>
  )
}
