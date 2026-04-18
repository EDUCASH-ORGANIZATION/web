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
    const { userId, amount, phone, operator } = await req.json()

    if (!userId || !amount || !phone || !operator) {
      return new Response(
        JSON.stringify({ error: "userId, amount, phone et operator sont requis" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    // Débite le wallet via la fonction SQL SECURITY DEFINER
    const { data: result, error: rpcError } = await supabase.rpc("wallet_withdraw", {
      p_user_id: userId,
      p_amount: amount,
    })

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      )
    }

    if (!result?.success) {
      return new Response(
        JSON.stringify({ error: result?.error ?? "Échec du débit wallet" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      )
    }

    // Appelle FedaPay Payout API
    const payoutResponse = await fetch("https://api.fedapay.com/v1/payouts", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + Deno.env.get("FEDAPAY_SECRET_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: { iso: "XOF" },
        mode: operator, // 'mtn' ou 'moov'
        customer: { phone_number: { number: phone, country: "BJ" } },
      }),
    })

    const payoutData = await payoutResponse.json()

    if (!payoutResponse.ok) {
      // Le wallet a déjà été débité — on logue l'erreur FedaPay mais on ne recrédite pas
      // (la réconciliation se fait manuellement ou via webhook FedaPay)
      console.error("FedaPay payout error:", payoutData)
    }

    // Met à jour le fedapay_id sur la transaction de retrait la plus récente
    if (payoutData?.id) {
      // .update() ne supporte pas .order()/.limit() — on sélectionne l'id d'abord
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
          .update({ fedapay_id: String(payoutData.id) })
          .eq("id", latestTx.id)
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Virement en cours" }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    )
  }
})
