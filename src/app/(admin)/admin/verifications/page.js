// @ds-screen RD-ADMIN-01
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getVerificationQueue } from "@/lib/actions/admin-verifications.actions"
import { VerificationsView } from "@/components/admin-space/verifications/verifications-view"
import { SkeletonRows } from "@/components/app-ui/skeletons"

export const metadata = { title: "Vérifications - Admin EduCash" }

// Données lues dans un composant à part pour que le squelette s'affiche pendant le chargement de la file.
async function QueueContent({ params }) {
  const result = await getVerificationQueue(params)
  return <VerificationsView data={result.error ? null : result} error={result.error} />
}

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
// Les paramètres d'URL sont validés par l'action (onglet en liste fermée, UUID, textes bornés).
export default async function AdminVerificationsPage({ searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const params = (await searchParams) ?? {}
  return (
    <Suspense key={JSON.stringify(params)} fallback={<SkeletonRows count={6} />}>
      <QueueContent params={params} />
    </Suspense>
  )
}
