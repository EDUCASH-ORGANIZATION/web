// @ds-screen RD-ADMIN-01
import { notFound, redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getAdminUserDetail } from "@/lib/actions/admin-users.actions"
import { UserDetailView } from "@/components/admin-space/users/user-detail-view"

export const metadata = { title: "Fiche utilisateur - Admin EduCash" }

// Page mince : contrôle admin, puis action `admin-*`. Identifiant invalide ou inconnu : 404 (aucun loading.js sous
// `users/`, sinon le statut deviendrait 200).
export default async function AdminUserPage({ params, searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const { id } = (await params) ?? {}
  const { onglet } = (await searchParams) ?? {}
  const result = await getAdminUserDetail(id, { onglet })
  if (result.notFound) notFound()
  return <UserDetailView data={result.error ? null : result} error={result.error} />
}
