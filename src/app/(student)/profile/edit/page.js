// @ds-screen RD-STUDENT-01
import { getStudentProfileForm } from "@/lib/actions/student-profile.actions"
import { StudentProfileEditView } from "@/components/student-space/profile/profile-form"

export const metadata = { title: "Modifier mon profil - EduCash" }

// Page mince : le téléphone (colonne privée de l'utilisateur) et les universités sont lus côté serveur par
// l'action. Sans lecture fiable du profil, la vue n'affiche pas le formulaire, qui enverrait un téléphone vide
// et l'effacerait.
export default async function StudentProfileEditPage() {
  const result = await getStudentProfileForm()
  return <StudentProfileEditView form={result.form} error={result.error} />
}
