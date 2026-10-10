// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import { extractBearerToken, corsHeaders } from "../_shared/auth.js"

const MIN_DEPOSIT_AMOUNT = 2000

const CORS = corsHeaders(Deno.env.get("APP_URL"))

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    // Authentification : jeton de session de l'utilisateur, jamais la cle anon seule
    const token = extractBearerToken(req.headers.get("Authorization"))
    if (!token) return json({ error: "Non authentifié" }, 401)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) return json({ error: "Non authentifié" }, 401)

    // L'identite vient uniquement du jeton, tout userId du corps est ignore
    const userId = authData.user.id

    // Autorisation sur profiles.role (jamais user_metadata) et statut de suspension
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_suspended")
      .eq("user_id", userId)
      .single()

    if (!profile || profile.is_suspended === true || profile.role !== "client") {
      return json({ error: "Action non autorisée" }, 403)
    }

    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: "Requête invalide" }, 400)
    }

    const amount = body?.amount
    if (!Number.isInteger(amount) || amount < MIN_DEPOSIT_AMOUNT) {
      return json({ error: "Montant invalide" }, 400)
    }

    // Vérifie que le wallet existe
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .single()

    if (walletError || !wallet) {
      console.error("[create-deposit-transaction] wallet not found")
      return json({ error: "Dépôt impossible pour le moment" }, 400)
    }

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
      console.error("[create-deposit-transaction] transaction create failed:", msg)
      return json({ error: "Paiement impossible pour le moment" }, 400)
    }

    // La réponse FedaPay encapsule sous la clé "v1/transaction"
    const transaction = createData?.["v1/transaction"]
    const transactionId = transaction?.id
    const paymentUrl    = transaction?.payment_url

    if (!transactionId || !paymentUrl) {
      console.error("[create-deposit-transaction] incomplete transaction response")
      return json({ error: "Paiement impossible pour le moment" }, 500)
    }

    return json({ paymentUrl, fedapayId: transactionId })
  } catch (err) {
    console.error("[create-deposit-transaction] unexpected error")
    return json({ error: "Erreur interne" }, 500)
  }
})
