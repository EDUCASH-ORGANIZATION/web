import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { AuthShell, BRAND_PANELS } from "@/components/vitrine/auth-shell"
import { knownRole, loginHref } from "@/lib/auth/destinations"
import { safeNextPath } from "@/lib/utils/safe-next"

export const metadata = {
  title: "Mot de passe oublié",
}

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ForgotPasswordPage({ searchParams }) {
  const params = await searchParams
  const next = safeNextPath(first(params.next))
  const role = knownRole(first(params.role), next)

  const base = loginHref({ next })
  const backHref = role === "student" ? `${base}${base.includes("?") ? "&" : "?"}role=student` : base

  // Public inconnu : panneau bleu avec le texte vouvoyé des clients.
  return (
    <AuthShell
      audience={role === "client" ? "client" : "student"}
      brand={role ? undefined : BRAND_PANELS.client}
      backHref={backHref}
      backLabel="Retour à la connexion"
    >
      <ForgotPasswordForm role={role} />
    </AuthShell>
  )
}
