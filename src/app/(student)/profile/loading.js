// @ds-screen RD-STUDENT-01
import { SkeletonHero, SkeletonStats, SkeletonRows } from "@/components/app-ui/skeletons"

// Squelette fidèle au profil : identité, chiffres, sections. Un seul bloc est annoncé.
// Ce segment (et ses enfants edit et verify) n'appelle jamais notFound() : le loading.js ne transforme aucun 404 en 200.
export default function StudentProfileLoading() {
  return (
    <div className="page2">
      <SkeletonHero />
      <SkeletonStats announce={false} />
      <SkeletonRows count={3} announce={false} />
    </div>
  )
}
