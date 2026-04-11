import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  )

  const today = new Date().toISOString().split("T")[0]

  // ── 1. Récupère les profils dont le badge expire aujourd'hui
  //       (avant de les désactiver, pour avoir leurs infos pour l'email)
  const { data: expiredProfiles, error: fetchError } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .eq("is_verified", true)
    .not("verified_until", "is", null)
    .lt("verified_until", today)

  if (fetchError) {
    console.error("[check-verifications-expiry] fetch error:", fetchError.message)
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  const count = expiredProfiles?.length ?? 0

  if (count === 0) {
    return new Response(
      JSON.stringify({ checked: 0, message: "Aucun badge expiré." }),
      { headers: { "Content-Type": "application/json" } }
    )
  }

  // ── 2. Désactive les badges expirés via la fonction SQL RPC
  //       check_verification_expiry() repasse is_verified = false
  //       pour tout profil dont verified_until < CURRENT_DATE
  const { error: rpcError } = await supabase.rpc("check_verification_expiry")
  if (rpcError) {
    console.error("[check-verifications-expiry] rpc error:", rpcError.message)
    // On continue quand même pour envoyer les emails
  }

  // ── 3. Envoie un email à chaque étudiant concerné
  const appUrl = Deno.env.get("APP_URL") ?? "https://educash.bj"
  let emailsSent = 0
  let emailErrors = 0

  for (const profile of expiredProfiles) {
    try {
      // Récupère l'email depuis auth.users via l'Admin API
      const { data: authData, error: authError } = await supabase.auth.admin
        .getUserById(profile.user_id)

      if (authError || !authData?.user?.email) {
        console.warn("[check-verifications-expiry] no email for user:", profile.user_id)
        emailErrors++
        continue
      }

      // Appelle la Edge Function send-email (si elle existe)
      // ou fait un appel direct à Resend
      const { error: invokeError } = await supabase.functions.invoke("send-email", {
        body: {
          template: "verification-expired",
          to: authData.user.email,
          data: {
            name:   profile.full_name?.split(" ")[0] ?? "Étudiant",
            appUrl,
          },
        },
      })

      if (invokeError) {
        console.error("[check-verifications-expiry] email error for", profile.user_id, invokeError)
        emailErrors++
      } else {
        emailsSent++
      }
    } catch (err) {
      console.error("[check-verifications-expiry] unexpected error for", profile.user_id, err)
      emailErrors++
    }
  }

  return new Response(
    JSON.stringify({
      checked:     count,
      emails_sent: emailsSent,
      email_errors: emailErrors,
      message:     `${count} badge(s) expiré(s) désactivé(s), ${emailsSent} email(s) envoyé(s).`,
    }),
    { headers: { "Content-Type": "application/json" } }
  )
})
