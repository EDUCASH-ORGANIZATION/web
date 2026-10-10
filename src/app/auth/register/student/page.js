import Link from "next/link"
import { redirect } from "next/navigation"
import { OnboardingWizard, parseStep } from "@/components/auth/student-onboarding/onboarding-wizard"
import { AuthShell } from "@/components/vitrine/auth-shell"
import { Icon } from "@/components/design/icon"
import { logout } from "@/lib/actions/auth.actions"
import { getOnboardingState } from "@/lib/actions/onboarding.actions"
import { getUniversities } from "@/lib/actions/university.actions"
import { dashboardFor, loginHref, resolvePostAuth } from "@/lib/auth/destinations"
import { safeNextPath } from "@/lib/utils/safe-next"

export const metadata = {
  title: "Mon profil étudiant",
}

const BRAND = {
  lines: ["3 étapes.", "2 minutes."],
  highlight: "C'est parti.",
  points: [
    { icon: "i-lock", title: "Tes infos restent privées.", text: "Le client voit ton prénom, ta ville et ton badge, jamais ton numéro avant d'être retenu." },
    { icon: "i-search", title: "Les missions d'abord.", text: "Tu vois toutes les missions dès la fin de l'inscription." },
  ],
}

const first = (value) => (Array.isArray(value) ? value[0] : value)

// Écran affiché à la place de l'assistant quand l'accès n'est pas possible.
function Blocked({ title, text, role }) {
  const home = dashboardFor(role)
  return (
    <div className="auth__form">
      <div className="stack stack--3">
        <h1 className="ds-h1">{title}</h1>
        <p className="muted">{text}</p>
      </div>
      {home && (
        <Link className="btn btn--primary btn--block" href={home}>
          Aller à mon espace
        </Link>
      )}
      <form action={logout}>
        <button className="btn btn--secondary btn--block" type="submit">
          <Icon name="i-logout" />
          Me déconnecter
        </button>
      </form>
    </div>
  )
}

export default async function StudentOnboardingPage({ searchParams }) {
  const params = await searchParams
  const next = safeNextPath(first(params?.next))
  const state = await getOnboardingState("student")

  if (state.status === "unauthenticated") redirect(loginHref({ next }))
  if (state.status === "ok" && state.profileComplete) {
    redirect(resolvePostAuth({ role: "student", profileComplete: true, next }))
  }

  if (state.status !== "ok") {
    const suspended = state.status === "suspended"
    return (
      <AuthShell audience="student" brand={BRAND}>
        <Blocked
          role={state.role}
          title={suspended ? "Compte suspendu" : "Session incorrecte"}
          text={
            suspended
              ? "Ton compte est suspendu. Contacte-nous pour en savoir plus."
              : "Cette page est réservée aux étudiants. Reconnecte-toi avec ton compte étudiant."
          }
        />
      </AuthShell>
    )
  }

  const universities = (await getUniversities()).map(({ id, name, short_name, city }) => ({ id, name, short_name, city }))
  const { profile } = state

  return (
    <AuthShell audience="student" brand={BRAND} signOutAction={logout}>
      <OnboardingWizard
        userId={state.user.id}
        next={next}
        initialStep={parseStep(first(params?.etape))}
        initialValues={{
          fullName: profile?.full_name ?? "",
          city: profile?.city ?? "",
        }}
        universities={universities}
      />
    </AuthShell>
  )
}
