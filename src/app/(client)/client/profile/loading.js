// @ds-screen RD-CLIENT-01
import { SkeletonHero, SkeletonStats, SkeletonRows } from "@/components/app-ui/skeletons"

// Squelette fidèle au profil : identité, chiffres, avis. Un seul bloc est annoncé.
// Ce segment n'appelle jamais notFound() : le loading.js ne transforme aucun 404 en 200.
export default function ClientProfileLoading() {
  return (
    <div className="page2">
      <SkeletonHero />
      <SkeletonStats announce={false} />
      <SkeletonRows count={3} announce={false} />
    </div>
  )
}
