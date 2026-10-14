// @ds-screen RD-STUDENT-01
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { getStudentVerification } from "@/lib/actions/student-verification.actions"
import { studentProfileHref } from "@/lib/app/student-routes"
import { VerifyView } from "@/components/student-space/verify/verify-view"

export const metadata = { title: "Vérification du compte - EduCash" }

// Page mince : le statut vient de l'action (requireRole étudiant), la vue est pure. Seul un badge valable
// (« Compte vérifié ») renvoie au profil, où il est affiché : un badge à renouveler ou expiré (is_verified reste
// à vrai), une carte en attente ou refusée gardent cette page.
export default async function ProfileVerifyPage() {
  const result = await getStudentVerification()
  // Refus ou lecture en échec : sans session, retour à la connexion ; sinon l'état d'échec (jamais un faux statut).
  if (result.error && !(await getCurrentUser())) redirect("/auth/login")
  if (result.verification?.key === "verified") redirect(studentProfileHref())
  return <VerifyView result={result} />
}
