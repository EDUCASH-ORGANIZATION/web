// @ds-screen RD-CLIENT-01
import { SkeletonHero, SkeletonStats, SkeletonRows } from "@/components/app-ui/skeletons"

// Squelette fidèle au tableau de bord : en-tête, décision, argent, liste. Un seul bloc est annoncé.
export default function ClientDashboardLoading() {
  return (
    <div className="page2">
      <SkeletonHero />
      <SkeletonStats announce={false} />
      <SkeletonRows count={3} announce={false} />
    </div>
  )
}
