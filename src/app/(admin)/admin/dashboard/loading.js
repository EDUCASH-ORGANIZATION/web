// @ds-screen RD-ADMIN-01
import { SkeletonHero, SkeletonStats, SkeletonRows } from "@/components/app-ui/skeletons"

// Squelette fidèle au tableau de bord : file à traiter, argent et missions, liste. Un seul bloc est annoncé.
// Le segment n'appelle jamais notFound : un loading.js y est sûr.
export default function AdminDashboardLoading() {
  return (
    <div className="a2-01">
      <SkeletonHero />
      <SkeletonStats announce={false} />
      <SkeletonRows count={3} announce={false} />
    </div>
  )
}
