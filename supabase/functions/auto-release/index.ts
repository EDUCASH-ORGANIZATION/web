import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    // Missions in_progress dont updated_at dépasse 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: missions, error: queryError } = await supabase
      .from("missions")
      .select("id, client_id, selected_student_id, budget")
      .eq("status", "in_progress")
      .lt("updated_at", cutoff)

    if (queryError) {
      console.error("Query error:", queryError)
      return new Response(
        JSON.stringify({ error: queryError.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      )
    }

    const results = []

    for (const mission of missions ?? []) {
      if (!mission.selected_student_id) continue

      // Libère les fonds via la fonction SQL SECURITY DEFINER
      const { data: releaseResult, error: releaseError } = await supabase.rpc(
        "wallet_release",
        {
          p_client_id:    mission.client_id,
          p_student_id:   mission.selected_student_id,
          p_mission_id:   mission.id,
          p_amount_total: mission.budget,
        }
      )

      if (releaseError) {
        console.error(`Release error for mission ${mission.id}:`, releaseError)
        results.push({ missionId: mission.id, success: false, error: releaseError.message })
        continue
      }

      // Marque la mission comme terminée
      await supabase
        .from("missions")
        .update({ status: "done" })
        .eq("id", mission.id)

      // Notifie l'étudiant par email
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(mission.selected_student_id)
        const studentEmail = userData?.user?.email

        if (studentEmail) {
          const { data: studentProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", mission.selected_student_id)
            .single()

          const { data: missionData } = await supabase
            .from("missions")
            .select("title")
            .eq("id", mission.id)
            .single()

          const amountStudent = releaseResult?.amount_student ?? 0
          const amountFormatted = new Intl.NumberFormat("fr-FR").format(amountStudent)
          const firstName = studentProfile?.full_name?.split(" ")[0] ?? "Étudiant"

          await fetch(
            `${Deno.env.get("APP_URL")}/api/email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("INTERNAL_API_SECRET") ?? ""}`,
              },
              body: JSON.stringify({
                template: "payment-received-wallet",
                to: studentEmail,
                data: {
                  firstName,
                  amount:       amountFormatted,
                  missionTitle: missionData?.title ?? "la mission",
                },
              }),
            }
          )
        }
      } catch (emailErr) {
        console.error(`[auto-release] Email error for mission ${mission.id}:`, emailErr)
      }

      results.push({ missionId: mission.id, success: true })
    }

    return new Response(
      JSON.stringify({ released: results.filter((r) => r.success).length, results }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    )
  }
})
