// @ds-screen RD-ADMIN-01
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { listAdminUsers } from "@/lib/actions/admin-users.actions"
import { UsersView } from "@/components/admin-space/users/users-view"

export const metadata = { title: "Utilisateurs - Admin EduCash" }

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
// Les paramètres d'URL sont validés par l'action (listes fermées, textes et page bornés).
export default async function AdminUsersPage({ searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const result = await listAdminUsers((await searchParams) ?? {})
  return <UsersView data={result.error ? null : result} error={result.error} />
}
