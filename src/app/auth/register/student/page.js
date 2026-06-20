import { StudentProfileForm } from "@/components/auth/student-profile-form"
import { AuthShell } from "@/components/vitrine/auth-shell"

export const metadata = {
  title: "Mon profil étudiant — EduCash",
}

export default function StudentOnboardingPage() {
  return (
    <AuthShell maxWidth={520}>
      <StudentProfileForm />
    </AuthShell>
  )
}
