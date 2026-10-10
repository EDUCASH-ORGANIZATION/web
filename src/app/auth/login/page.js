import { LoginForm } from "@/components/auth/login-form"
import { AuthShell, BRAND_PANELS } from "@/components/vitrine/auth-shell"
import { knownRole } from "@/lib/auth/destinations"
import { safeNextPath } from "@/lib/utils/safe-next"

export const metadata = {
  title: "Connexion",
}

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

export default async function LoginPage({ searchParams }) {
  const params = await searchParams
  const next = safeNextPath(first(params.next))
  const role = knownRole(first(params.role), next)

  const forgot = new URLSearchParams()
  if (role === "student") forgot.set("role", "student")
  if (next) forgot.set("next", next)
  const forgotHref = `/auth/forgot-password${forgot.size ? `?${forgot}` : ""}`

  // Public inconnu : panneau bleu avec le texte vouvoyé des clients.
  return (
    <AuthShell audience={role === "client" ? "client" : "student"} brand={role ? undefined : BRAND_PANELS.client}>
      <LoginForm role={role} next={next} forgotHref={forgotHref} />
    </AuthShell>
  )
}
