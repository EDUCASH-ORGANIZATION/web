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
    const { userId, amount } = await req.json()

    if (!userId || !amount) return json({ error: "userId et amount sont requis" }, 400)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Vérifie que le wallet existe
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .single()

    if (walletError || !wallet) return json({ error: "Wallet introuvable pour cet utilisateur" }, 404)

    const fedaBase = Deno.env.get("FEDAPAY_API_URL") ?? "https://sandbox-api.fedapay.com"
    const fedaHeaders = {
      "Authorization": "Bearer " + Deno.env.get("FEDAPAY_SECRET_KEY"),
      "Content-Type": "application/json",
    }

    // ── Étape 1 : créer la transaction ──────────────────────────────────────────
    // callback_url = redirection navigateur après paiement (?id=X&status=approved|canceled)
    // Le webhook FedaPay est configuré dans le Dashboard FedaPay, pas ici
    const createRes = await fetch(`${fedaBase}/v1/transactions`, {
      method: "POST",
      headers: fedaHeaders,
      body: JSON.stringify({
        amount,
        description: "Recharge wallet EduCash",
        callback_url: Deno.env.get("APP_URL")?.replace(/\/$/, "") + "/client/wallet",
        currency: { iso: "XOF" },
        custom_metadata: { userId, type: "wallet_deposit" },
      }),
    })

    const createData = await createRes.json()

    if (!createRes.ok) {
      const msg = createData?.message ?? createData?.error ?? "Erreur inconnue"
      return json({ error: "Erreur FedaPay: " + msg }, 400)
    }

    // La réponse FedaPay encapsule sous la clé "v1/transaction"
    const transaction = createData?.["v1/transaction"]
    const transactionId = transaction?.id
    const paymentUrl    = transaction?.payment_url

    if (!transactionId) return json({ error: "ID de transaction FedaPay manquant" }, 500)
    if (!paymentUrl)    return json({ error: "URL de paiement manquante" }, 500)

    return json({ paymentUrl, fedapayId: transactionId })
  } catch (err) {
    return json({ error: err?.message ?? "Erreur interne" }, 500)
  }
})
