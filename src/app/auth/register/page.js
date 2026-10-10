import { RegisterForm } from "@/components/auth/register-form"
import { AuthShell } from "@/components/vitrine/auth-shell"
import { audienceFor } from "@/lib/auth/destinations"
import { SIGNUP_ROLES } from "@/lib/auth/schemas"
import { safeNextPath } from "@/lib/utils/safe-next"

export const metadata = {
  title: "Inscription",
}

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams
  const rawRole = first(params?.role)
  // Seuls student et client sont acceptés : tout autre rôle (dont admin) est ignoré.
  const role = SIGNUP_ROLES.includes(rawRole) ? rawRole : null
  // `redirect` est l'alias historique de `next`.
  const next = safeNextPath(first(params?.next)) ?? safeNextPath(first(params?.redirect))
  const audience = role ?? audienceFor({ next })

  return (
    <AuthShell audience={audience}>
      <RegisterForm role={role} audience={audience} next={next} />
    </AuthShell>
  )
}
