import { LinkExpiredForm } from "@/components/auth/link-expired-form"
import { AuthShell } from "@/components/vitrine/auth-shell"
import { audienceFor } from "@/lib/auth/destinations"
import { SIGNUP_ROLES } from "@/lib/auth/schemas"
import { safeNextPath } from "@/lib/utils/safe-next"

export const metadata = { title: "Lien invalide ou expiré" }

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

export default async function LinkExpiredPage({ searchParams }) {
  const params = await searchParams
  // Une cause inconnue est ramenée à « invalide » par le formulaire.
  const cause = first(params?.cause)
  const flow = first(params?.flow) === "recovery" ? "recovery" : "signup"
  const rawRole = first(params?.role)
  const role = SIGNUP_ROLES.includes(rawRole) ? rawRole : null
  const next = safeNextPath(first(params?.next))
  // Page neutre : vouvoiement par défaut (l'accueil parle aux clients), tutoiement si le rôle étudiant est connu.
  const audience = role ?? audienceFor({ next }, "client")

  return (
    <AuthShell audience={audience}>
      <LinkExpiredForm cause={cause} flow={flow} audience={audience} role={role} next={next} />
    </AuthShell>
  )
}
