import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { AuthShell, BRAND_PANELS } from "@/components/vitrine/auth-shell"
import { audienceFor, loginHref } from "@/lib/auth/destinations"
import { isNextAllowedForRole, safeNextPath } from "@/lib/utils/safe-next"

export const metadata = {
  title: "Mot de passe oublié",
}

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

// Public connu : role explicite, ou next sous /client (client) ou dans l'espace étudiant (student).
function knownRole(role, next) {
  if (role === "student" || role === "client") return role
  if (audienceFor({ next }, null)) return "client"
  if (next && isNextAllowedForRole(next, "student") && !isNextAllowedForRole(next, "client")) return "student"
  return null
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
      <ForgotPasswordForm role={role} loginHref={backHref} />
    </AuthShell>
  )
}
