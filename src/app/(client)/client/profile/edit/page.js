// @ds-screen RD-CLIENT-01
import { getClientProfileSummary } from "@/lib/actions/profile.actions"
import { ProfileEditView } from "@/components/client-space/profile/profile-edit-form"

export const metadata = { title: "Modifier mon profil - EduCash" }

// Page mince : le téléphone (colonne privée) est lu côté serveur par l'action. Sans lecture fiable du profil,
// la vue n'affiche pas le formulaire, qui enverrait un téléphone vide et l'effacerait.
export default async function ClientProfileEditPage() {
  const result = await getClientProfileSummary()
  return <ProfileEditView summary={result.summary} error={result.error} />
}
