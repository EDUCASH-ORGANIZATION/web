import { LoginForm } from "@/components/auth/login-form"
import { AuthShell } from "@/components/vitrine/auth-shell"
import { safeNextPath } from "@/lib/utils/safe-next"

export const metadata = {
  title: "Connexion",
}

export default async function LoginPage({ searchParams }) {
  const { next } = await searchParams
  const safeNext = safeNextPath(Array.isArray(next) ? next[0] : next)

  return (
    <AuthShell title="Bon retour 👋" subtitle="Connecte-toi à ton compte EduCash" maxWidth={460}>
      <LoginForm next={safeNext} />
    </AuthShell>
  )
}
