// @ds-screen RD-STUDENT-01
import { getMyClosurePreview, closeMyAccount } from "@/lib/actions/account-closure.actions"
import { CloseAccountView } from "@/components/app-ui/close-account"

export const metadata = { title: "Fermer mon compte - EduCash" }

// Page mince : les blocages et l'échéance viennent de `getMyClosurePreview` (requireRole dans l'action), la fermeture
// de `closeMyAccount` ; la vue est pure. Rien n'est modifié à l'affichage.
export default async function StudentCloseAccountPage() {
  const preview = await getMyClosurePreview()
  return <CloseAccountView space="student" preview={preview} closeAction={closeMyAccount} />
}
