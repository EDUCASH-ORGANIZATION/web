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
    const { userId, amount } = await req.json()

    if (!userId || !amount) {
      return new Response(
        JSON.stringify({ error: "userId et amount sont requis" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    // Vérifie que le wallet existe
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .single()

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: "Wallet introuvable pour cet utilisateur" }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      )
    }

    // Crée la transaction FedaPay
    const fedaResponse = await fetch("https://api.fedapay.com/v1/transactions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + Deno.env.get("FEDAPAY_SECRET_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        description: "Recharge wallet EduCash",
        callback_url: Deno.env.get("APP_URL") + "/api/webhooks/fedapay",
        cancel_url: Deno.env.get("APP_URL") + "/client/wallet?status=cancelled",
        currency: { iso: "XOF" },
        metadata: { userId, type: "wallet_deposit" },
      }),
    })

    const fedaData = await fedaResponse.json()

    if (!fedaResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erreur FedaPay: " + (fedaData.message ?? "inconnue") }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      )
    }

    const paymentUrl = fedaData.payment_url ?? fedaData.links?.payment_url ?? null

    return new Response(
      JSON.stringify({ paymentUrl, fedapayId: fedaData.id }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    )
  }
})
