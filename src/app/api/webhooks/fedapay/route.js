import { createClient } from "@supabase/supabase-js"
import { createHmac } from "crypto"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

// ─── POST /api/webhooks/fedapay ───────────────────────────────────────────────

export async function POST(request) {
  const payload = await request.text()
  const signature = request.headers.get("x-fedapay-signature")

  // Vérifie la signature HMAC-SHA256
  const expectedSig = createHmac("sha256", process.env.FEDAPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex")

  if (signature !== expectedSig) {
    console.warn("[webhook/fedapay] Signature invalide")
    return new Response("Unauthorized", { status: 401 })
  }

  let event
  try {
    event = JSON.parse(payload)
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  // Client Supabase avec service role pour bypasser RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // ── transaction.approved ────────────────────────────────────────────────────

  if (event.name === "transaction.approved") {
    const metadata  = event.entity?.metadata ?? {}
    const fedapayId = String(event.entity.id)
    const amount    = event.entity.amount

    // ── Cas 1 : dépôt wallet ──────────────────────────────────────────────────
    if (metadata.type === "wallet_deposit") {
      const { data: result, error: rpcError } = await supabase.rpc("wallet_deposit", {
        p_user_id:    metadata.userId,
        p_amount:     amount,
        p_fedapay_id: fedapayId,
      })

      if (rpcError) {
        console.error("[webhook/fedapay] wallet_deposit RPC error:", rpcError)
        // On retourne 200 pour éviter les retries FedaPay
        return new Response("OK", { status: 200 })
      }

      if (result?.success) {
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(metadata.userId)
          const clientEmail = userData?.user?.email

          if (clientEmail) {
            const { data: clientProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", metadata.userId)
              .single()

            const firstName = clientProfile?.full_name?.split(" ")[0] ?? "Client"

            const { sendEmail } = await import("@/lib/email/index")
            await sendEmail("wallet-deposited", clientEmail, {
              firstName,
              amount:     fmt(amount),
              newBalance: fmt(result.new_balance ?? 0),
            })
          }
        } catch (emailErr) {
          console.error("[webhook/fedapay] Erreur envoi email wallet-deposited:", emailErr)
        }
      }

      return new Response("OK", { status: 200 })
    }

    // ── Cas 2 : paiement direct de mission (ancien flux) ──────────────────────
    if (!metadata.type || metadata.type === "mission_payment") {
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("fedapay_id", fedapayId)
        .select()
        .single()

      if (txError || !transaction) {
        console.error("[webhook/fedapay] Transaction mission introuvable pour fedapay_id:", fedapayId, txError)
        return new Response("OK", { status: 200 })
      }

      const { data: mission } = await supabase
        .from("missions")
        .update({ status: "done" })
        .eq("id", transaction.mission_id)
        .select("title, selected_student_id")
        .single()

      if (mission?.selected_student_id) {
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(
            mission.selected_student_id
          )
          const studentEmail = userData?.user?.email

          if (studentEmail) {
            const { data: studentProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", mission.selected_student_id)
              .single()

            const { sendEmail } = await import("@/lib/email/index")
            await sendEmail("payment-received", studentEmail, {
              studentName:  studentProfile?.full_name ?? "Étudiant",
              amount:       fmt(transaction.amount_student),
              missionTitle: mission.title,
              paidAt:       transaction.paid_at,
            })
          }
        } catch (emailErr) {
          console.error("[webhook/fedapay] Erreur envoi email payment-received:", emailErr)
        }
      }

      return new Response("OK", { status: 200 })
    }

    // Type inconnu — on log et on acquitte
    console.warn("[webhook/fedapay] metadata.type inconnu:", metadata.type)
  }

  // ── transaction.declined ────────────────────────────────────────────────────

  if (event.name === "transaction.declined") {
    const metadata  = event.entity?.metadata ?? {}
    const fedapayId = String(event.entity.id)

    if (metadata.type === "wallet_deposit") {
      // Aucune modification wallet — on log seulement
      console.warn("[webhook/fedapay] Dépôt wallet échoué, fedapayId:", fedapayId)
    } else {
      // Ancien flux : marque la transaction mission comme échouée
      const { error } = await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("fedapay_id", fedapayId)

      if (error) {
        console.error("[webhook/fedapay] Impossible de marquer transaction échouée:", error)
      }
    }
  }

  // Toujours 200 — FedaPay ne doit pas retenter
  return new Response("OK", { status: 200 })
}
