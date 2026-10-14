import { cookies } from "next/headers"
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel"
import { AuthShell } from "@/components/vitrine/auth-shell"
import { PENDING_EMAIL_COOKIE } from "@/lib/auth/cookies"
import { audienceFor, registerHref } from "@/lib/auth/destinations"
import { SIGNUP_ROLES } from "@/lib/auth/schemas"
import { safeNextPath } from "@/lib/utils/safe-next"

export const metadata = { title: "Vérification de l'email" }

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

export default async function VerifyEmailPage({ searchParams }) {
  const params = await searchParams
  const rawRole = first(params?.role)
  const role = SIGNUP_ROLES.includes(rawRole) ? rawRole : null
  const next = safeNextPath(first(params?.next))
  // Page neutre : le public (panneau visuel et parcours) vient du rôle connu, sinon de `next` (client par défaut).
  const audience = role ?? audienceFor({ next }, "client")

  const cookieStore = await cookies()
  // L'adresse vient du cookie httpOnly posé à l'inscription, jamais de l'URL.
  const email = cookieStore.get(PENDING_EMAIL_COOKIE)?.value || null

  return (
    <AuthShell audience={audience} backHref={registerHref({ role, next })} backLabel="Retour à l'inscription">
      <VerifyEmailPanel email={email} role={role} next={next} />
    </AuthShell>
  )
}
