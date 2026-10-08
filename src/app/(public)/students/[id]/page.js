import { permanentRedirect } from "next/navigation"
import { talentPathFromLegacy } from "@/lib/vitrine/legacy-redirect"

// Ancienne route : le profil public vit désormais sous /talents/[id].
export default async function LegacyStudentPage({ params, searchParams }) {
  const { id } = await params
  permanentRedirect(talentPathFromLegacy(id, await searchParams))
}
