import { ClosedAccountPanel } from "@/components/vitrine/closure/closed-account-panel"
import { AuthShell } from "@/components/vitrine/auth-shell"
import { parseClosureDeadline } from "@/lib/app/closure-screen"

export const metadata = { title: "Compte fermé - EduCash", robots: { index: false, follow: false } }

// Page publique, sans session ni accès aux données : la date limite vient de ?jusquau=, lue avec prudence
// (forme ISO stricte et fenêtre plausible), sinon le texte ne cite aucune date. Aucune action ici.
export default async function ClosedAccountPage({ searchParams }) {
  const params = await searchParams
  return (
    <AuthShell audience="client">
      <ClosedAccountPanel deadline={parseClosureDeadline(params?.jusquau)} />
    </AuthShell>
  )
}
