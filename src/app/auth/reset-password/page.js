import { cookies } from "next/headers"
import { ResetLinkExpired, ResetPasswordForm } from "@/components/auth/reset-password-form"
import { AuthShell, BRAND_PANELS } from "@/components/vitrine/auth-shell"
import { RECOVERY_COOKIE } from "@/lib/auth/cookies"
import { createClient } from "@/lib/supabase/server"

export const metadata = {
  title: "Nouveau mot de passe",
}

// Le formulaire n'est affiché qu'avec une session de récupération ouverte par /auth/confirm
// (cookie ec_recovery ET utilisateur authentifié). Sinon : état « lien expiré » vers A05.
export default async function ResetPasswordPage() {
  const cookieStore = await cookies()
  let user = null
  if (cookieStore.get(RECOVERY_COOKIE)?.value) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  }

  return (
    <AuthShell audience="student" brand={BRAND_PANELS.client} backHref="/auth/login" backLabel="Retour à la connexion">
      {user ? <ResetPasswordForm email={user.email ?? ""} /> : <ResetLinkExpired />}
    </AuthShell>
  )
}
