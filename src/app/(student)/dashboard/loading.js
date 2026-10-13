// @ds-screen RD-STUDENT-01
import { SkeletonHero, SkeletonStats, SkeletonRows } from "@/components/app-ui/skeletons"

// Squelette fidèle au tableau de bord : en-tête, argent et action, indicateurs, liste. Un seul bloc est annoncé.
// Le segment n'appelle jamais notFound : un loading.js y est sûr.
export default function StudentDashboardLoading() {
  return (
    <div className="page2">
      <SkeletonHero />
      <SkeletonStats announce={false} />
      <SkeletonRows count={3} announce={false} />
    </div>
  )
}
