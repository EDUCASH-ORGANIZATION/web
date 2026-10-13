// @ds-screen RD-CLIENT-01
import { getClientProfileSummary } from "@/lib/actions/profile.actions"
import { logout } from "@/lib/actions/auth.actions"
import { ClientProfileView } from "@/components/client-space/profile/profile-view"

export const metadata = { title: "Mon profil - EduCash" }

// Page mince : identité, chiffres (dont le total dépensé du grand livre) et avis viennent de l'action
// `getClientProfileSummary` (requireRole client) ; la vue est pure. Sans session ni rôle client, le layout a déjà redirigé.
export default async function ClientProfilePage() {
  const result = await getClientProfileSummary()
  return <ClientProfileView summary={result.summary} error={result.error} logoutAction={logout} />
}
