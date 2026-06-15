// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const { userId, amount, phone, operator } = await req.json()

    if (!userId || !amount || !phone || !operator) {
      return json({ error: "userId, amount, phone et operator sont requis" }, 400)
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Récupère le profil pour firstname/lastname (requis par FedaPay)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single()

    const nameParts = (profile?.full_name ?? "Utilisateur EduCash").split(" ")
    const firstname = nameParts[0] ?? "Utilisateur"
    const lastname  = nameParts.slice(1).join(" ") || "EduCash"

    // Débite le wallet via la fonction SQL SECURITY DEFINER
    const { data: result, error: rpcError } = await supabase.rpc("wallet_withdraw", {
      p_user_id: userId,
      p_amount:  amount,
    })

    if (rpcError)        return json({ error: rpcError.message }, 400)
    if (!result?.success) return json({ error: result?.error ?? "Échec du débit wallet" }, 400)

    const fedaBase = Deno.env.get("FEDAPAY_API_URL") ?? "https://sandbox-api.fedapay.com"
    const fedaHeaders = {
      "Authorization": "Bearer " + Deno.env.get("FEDAPAY_SECRET_KEY"),
      "Content-Type": "application/json",
    }

    // ── Étape 1 : créer le payout ────────────────────────────────────────────────
    const createRes = await fetch(`${fedaBase}/v1/payouts`, {
      method: "POST",
      headers: fedaHeaders,
      body: JSON.stringify({
        amount,
        currency: { iso: "XOF" },
        customer: {
          firstname,
          lastname,
          phone_number: { number: phone, country: "bj" },
        },
        custom_metadata: { userId, type: "wallet_withdrawal" },
      }),
    })

    const createData = await createRes.json()

    if (!createRes.ok) {
      console.error("FedaPay payout create error:", createData)
      // Le wallet est déjà débité — on logue mais on continue
    }

    const payoutId = createData?.v1?.id ?? createData?.id

    // ── Étape 2 : initier l'envoi ────────────────────────────────────────────────
    if (payoutId) {
      const startRes = await fetch(`${fedaBase}/v1/payouts/start`, {
        method: "PUT",
        headers: fedaHeaders,
        body: JSON.stringify([{
          id: payoutId,
          phone_number: { number: phone, country: "bj" },
          mode: operator, // 'mtn' | 'moov'
        }]),
      })

      if (!startRes.ok) {
        const startData = await startRes.json()
        console.error("FedaPay payout start error:", startData)
      }

      // Enregistre le fedapay_id sur la transaction de retrait
      const { data: latestTx } = await supabase
        .from("wallet_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "withdrawal")
        .is("fedapay_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (latestTx?.id) {
        await supabase
          .from("wallet_transactions")
          .update({ fedapay_id: String(payoutId) })
          .eq("id", latestTx.id)
      }
    }

    return json({ success: true, message: "Virement en cours" })
  } catch (err) {
    return json({ error: err?.message ?? "Erreur interne" }, 500)
  }
})
