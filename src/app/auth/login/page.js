import { LoginForm } from "@/components/auth/login-form"
import { AuthShell } from "@/components/vitrine/auth-shell"

export const metadata = {
  title: "Connexion — EduCash",
}

export default function LoginPage() {
  return (
    <AuthShell title="Bon retour 👋" subtitle="Connecte-toi à ton compte EduCash" maxWidth={460}>
      <LoginForm />
    </AuthShell>
  )
}
