// @ds-screen RD-ADMIN-01
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getAdminDashboard } from "@/lib/actions/admin-dashboard.actions"
import { AdminDashboardView } from "@/components/admin-space/dashboard/admin-dashboard-view"

export const metadata = { title: "Tableau de bord - Admin EduCash" }

/** Prénom d'affichage : premier mot du nom complet, ou chaîne vide. */
function firstNameOf(fullName) {
  return typeof fullName === "string" ? (fullName.trim().split(/\s+/)[0] ?? "") : ""
}

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
export default async function AdminDashboardPage() {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const result = await getAdminDashboard()
  return (
    <AdminDashboardView
      data={result.error ? null : result}
      error={result.error}
      firstName={firstNameOf(auth.profile?.full_name)}
    />
  )
}
