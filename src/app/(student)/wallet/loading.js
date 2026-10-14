// @ds-screen RD-STUDENT-01
import { SkeletonHero, SkeletonRows } from "@/components/app-ui/skeletons"

// Squelette fidèle au portefeuille : carte argent puis historique. Un seul bloc est annoncé.
// Ce segment n'appelle jamais notFound() et n'a aucun enfant : le loading.js ne transforme aucun 404 en 200.
export default function StudentWalletLoading() {
  return (
    <div className="page2">
      <SkeletonHero />
      <SkeletonRows count={4} announce={false} />
    </div>
  )
}
