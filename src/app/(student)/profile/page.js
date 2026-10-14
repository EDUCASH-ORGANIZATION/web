// @ds-screen RD-STUDENT-01
import { getStudentProfileSummary } from "@/lib/actions/student-profile.actions"
import { logout } from "@/lib/actions/auth.actions"
import { StudentProfileView } from "@/components/student-space/profile/profile-view"

export const metadata = { title: "Mon profil - EduCash" }

// Page mince : identité, statut de vérification calculé, chiffres (dont le total gagné du grand livre) et avis
// viennent de l'action `getStudentProfileSummary` (requireRole étudiant) ; la vue est pure. Sans session ni rôle
// étudiant, le layout a déjà redirigé.
export default async function StudentProfilePage() {
  const result = await getStudentProfileSummary()
  return <StudentProfileView summary={result.summary} error={result.error} logoutAction={logout} />
}
