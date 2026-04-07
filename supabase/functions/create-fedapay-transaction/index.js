import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const { missionId, amount, clientId, studentId, transactionId } = await req.json()

    const commission = amount * 0.12
    const netAmount = amount - commission

    const response = await fetch("https://api.fedapay.com/v1/transactions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + Deno.env.get("FEDAPAY_SECRET_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount,
        description: "Mission EduCash #" + missionId,
        callback_url:
          Deno.env.get("APP_URL") + "/payment/success?missionId=" + missionId,
        cancel_url: Deno.env.get("APP_URL") + "/payment/failed",
        currency: { iso: "XOF" },
        metadata: {
          mission_id: missionId,
          client_id: clientId,
          student_id: studentId,
          transaction_id: transactionId,
          commission: commission,
          net_amount: netAmount,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("FedaPay error:", err)
      return new Response(
        JSON.stringify({ error: "Erreur FedaPay : " + err }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const data = await response.json()

    return new Response(
      JSON.stringify({
        payment_url: data.payment_url || data.links?.payment_url,
        fedapay_id: data.id,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected error:", err)
    return new Response(
      JSON.stringify({ error: "Erreur interne du serveur" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }
})
