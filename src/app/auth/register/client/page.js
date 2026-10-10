import { redirect } from "next/navigation"
import { AuthShell } from "@/components/vitrine/auth-shell"
import { OnboardingWizard } from "@/components/auth/client-onboarding/onboarding-wizard"
import { CLIENT_ONBOARDING_BRAND, WrongSessionScreen } from "@/components/auth/client-onboarding/ready-screen"
import { getOnboardingState } from "@/lib/actions/onboarding.actions"
import { loginHref, resolvePostAuth } from "@/lib/auth/destinations"
import { isNextAllowedForRole, safeNextPath } from "@/lib/utils/safe-next"

export const metadata = {
  title: "Mon profil client",
}

// Valeur unique lue dans l'URL, jamais un tableau.
function single(value) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ClientOnboardingPage({ searchParams }) {
  const params = (await searchParams) ?? {}
  const requested = safeNextPath(single(params.next))
  const next = requested && isNextAllowedForRole(requested, "client") ? requested : undefined

  const state = await getOnboardingState("client")
  if (state.status === "unauthenticated") redirect(loginHref({ next }))

  if (state.status !== "ok") {
    return (
      <AuthShell audience="client" brand={CLIENT_ONBOARDING_BRAND}>
        <WrongSessionScreen status={state.status} role={state.role} email={state.user?.email} />
      </AuthShell>
    )
  }

  if (state.profileComplete) {
    redirect(resolvePostAuth({ role: "client", profileComplete: true, next }))
  }

  return (
    <AuthShell audience="client" brand={CLIENT_ONBOARDING_BRAND}>
      <OnboardingWizard userId={state.user.id} next={next} initialStep={Number(single(params.etape)) || 1} />
    </AuthShell>
  )
}
