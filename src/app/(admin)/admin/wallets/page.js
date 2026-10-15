// @ds-screen RD-ADMIN-01
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getAdminWallets } from "@/lib/actions/admin-finance.actions"
import { WalletsView } from "@/components/admin-space/wallets/wallets-view"
import { SkeletonRows } from "@/components/app-ui/skeletons"

export const metadata = { title: "Portefeuilles - Admin EduCash" }

// Données lues dans un composant à part pour que le squelette s'affiche pendant le chargement.
async function Content({ params }) {
  const result = await getAdminWallets(params)
  return <WalletsView data={result.error ? null : result} error={result.error} />
}

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue pure.
// Les paramètres d'URL sont validés par l'action (recherche nettoyée et bornée, page bornée).
export default async function AdminWalletsPage({ searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const params = (await searchParams) ?? {}
  return (
    <Suspense key={JSON.stringify({ q: params.q, page: params.page })} fallback={<SkeletonRows count={6} />}>
      <Content params={params} />
    </Suspense>
  )
}
