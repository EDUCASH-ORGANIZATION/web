// @ds-screen RD-ADMIN-01
import { redirect } from "next/navigation"

// /admin n'a pas de contenu propre : le tableau de bord est à /admin/dashboard.
export default function AdminIndexPage() {
  redirect("/admin/dashboard")
}
