// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import { extractBearerToken, corsHeaders } from "../_shared/auth.js"
import { validateWithdrawalBody, canWithdraw } from "./validate.js"

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
    const user = authData?.user
    if (authError || !user) return json({ error: "Non authentifié" }, 401)

    // L'identite vient uniquement du jeton, tout userId du corps est ignore
    const userId = user.id

    // Autorisation sur profiles.role (jamais user_metadata) et statut de suspension
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, is_suspended")
      .eq("user_id", userId)
      .single()

    if (!canWithdraw(profile)) return json({ error: "Action non autorisée" }, 403)

    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: "Requête invalide" }, 400)
    }

    const parsed = validateWithdrawalBody(body)
    if (!parsed.ok) return json({ error: parsed.error }, 400)
    const { amount, phone, operator } = parsed.value

    const nameParts = (profile?.full_name ?? "Utilisateur EduCash").split(" ")
    const firstname = nameParts[0] ?? "Utilisateur"
    const lastname  = nameParts.slice(1).join(" ") || "EduCash"

    // Débite le wallet via la fonction SQL SECURITY DEFINER (verifie le solde disponible)
    const { data: result, error: rpcError } = await supabase.rpc("wallet_withdraw", {
      p_user_id: userId,
      p_amount:  amount,
    })

    if (rpcError) {
      console.error("[process-withdrawal] wallet_withdraw rpc error:", rpcError.code)
      return json({ error: "Retrait impossible" }, 400)
    }
    if (!result?.success) return json({ error: result?.error ?? "Échec du débit wallet" }, 400)

    const fedaBase = Deno.env.get("FEDAPAY_API_URL") ?? "https://sandbox-api.fedapay.com"
    const fedaHeaders = {
      "Authorization": "Bearer " + Deno.env.get("FEDAPAY_SECRET_KEY"),
      "Content-Type": "application/json",
    }

    // Transaction de retrait fraichement debitee (reconciliation et fedapay_id)
    const { data: latestTx } = await supabase
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "withdrawal")
      .is("fedapay_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    // Le wallet est deja debite : tout echec ci-dessous exige une reconciliation manuelle
    const failure = () => {
      console.error(
        "[process-withdrawal] INCIDENT wallet debited but payout not started, wallet_transaction id:",
        latestTx?.id ?? "unknown"
      )
      return json({ error: "Le retrait n'a pas pu être lancé, contactez-nous" }, 502)
    }

    let payoutId
    try {
      // ── Étape 1 : créer le payout ──────────────────────────────────────────────
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
        console.error("[process-withdrawal] payout create failed, status", createRes.status)
        return failure()
      }
      payoutId = createData?.v1?.id ?? createData?.id
    } catch {
      console.error("[process-withdrawal] payout create request failed")
      return failure()
    }
    if (!payoutId) return failure()

    // ── Étape 2 : initier l'envoi ────────────────────────────────────────────────
    try {
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
        console.error("[process-withdrawal] payout start failed, status", startRes.status)
        return failure()
      }
    } catch {
      console.error("[process-withdrawal] payout start request failed")
      return failure()
    }

    // Enregistre le fedapay_id sur la transaction de retrait
    if (latestTx?.id) {
      await supabase
        .from("wallet_transactions")
        .update({ fedapay_id: String(payoutId) })
        .eq("id", latestTx.id)
    }

    return json({ success: true, message: "Virement en cours" })
  } catch (err) {
    console.error("[process-withdrawal] unexpected error")
    return json({ error: "Erreur interne" }, 500)
  }
})
