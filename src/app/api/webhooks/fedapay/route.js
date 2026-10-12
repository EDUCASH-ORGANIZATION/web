import { createHmac, timingSafeEqual } from "crypto"
import { paymentsEnabled } from "@/lib/constants/payments"
import { createServiceClient } from "@/lib/supabase/service"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

// Comparaison de signatures en temps constant ; longueur différente = refus.
function signatureMatches(received, expected) {
  if (typeof received !== "string") return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Devise de l'événement : code ISO en chaîne ou objet { iso }.
function currencyOf(entity) {
  const c = entity?.currency
  return typeof c === "string" ? c : c?.iso
}

// Un dépôt n'est crédité que si montant (entier > 0), devise (XOF) et utilisateur (UUID) sont valides.
function isValidDeposit(entity, userId) {
  return (
    Number.isInteger(entity?.amount) &&
    entity.amount > 0 &&
    currencyOf(entity) === "XOF" &&
    typeof userId === "string" &&
    UUID_RE.test(userId)
  )
}

// ─── POST /api/webhooks/fedapay ───────────────────────────────────────────────

export async function POST(request) {
  // Paiements fermes par defaut : avant toute lecture du corps
  if (!paymentsEnabled()) {
    return Response.json({ error: "Paiements désactivés" }, { status: 503 })
  }

  const webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[webhook/fedapay] FEDAPAY_WEBHOOK_SECRET non configuré - webhook désactivé")
    return new Response("Service Unavailable", { status: 503 })
  }

  const payload = await request.text()
  const signature = request.headers.get("x-fedapay-signature")

  // Vérifie la signature HMAC-SHA256
  const expectedSig = createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex")

  if (!signatureMatches(signature, expectedSig)) {
    console.warn("[webhook/fedapay] Signature invalide")
    return new Response("Unauthorized", { status: 401 })
  }

  let event
  try {
    event = JSON.parse(payload)
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  // ── transaction.approved ────────────────────────────────────────────────────

  if (event.name === "transaction.approved") {
    const metadata  = event.entity?.custom_metadata ?? event.entity?.metadata ?? {}

    // Seul le dépôt de portefeuille déclenche une écriture
    if (metadata.type !== "wallet_deposit" || event.entity?.id == null) {
      console.warn("[webhook/fedapay] metadata.type ignoré:", metadata.type)
      return new Response("OK", { status: 200 })
    }

    if (!isValidDeposit(event.entity, metadata.userId)) {
      console.warn("[webhook/fedapay] dépôt refusé : données invalides")
      return new Response("Bad Request", { status: 400 })
    }

    // Client service role (contourne la RLS) : ouvert seulement après vérification de signature
    const supabase = createServiceClient()
    const fedapayId = String(event.entity.id)
    const amount    = event.entity.amount

    // ── Dépôt wallet ──────────────────────────────────────────────────────────
    const { data: result, error: rpcError } = await supabase.rpc("wallet_deposit", {
      p_user_id:    metadata.userId,
      p_amount:     amount,
      p_fedapay_id: fedapayId,
    })

    // Erreur ou refus : 500 pour provoquer un rejeu (l'idempotence SQL sur l'identifiant de paiement
    // empêche tout double crédit).
    if (rpcError || result?.success !== true) {
      console.error("[webhook/fedapay] wallet_deposit en échec:", rpcError ?? result)
      return new Response("Internal Server Error", { status: 500 })
    }

    // Rejeu d'un dépôt déjà crédité : aucun second email
    if (!result.already_processed) {
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

  // ── transaction.declined ────────────────────────────────────────────────────

  if (event.name === "transaction.declined") {
    // Aucune modification : on journalise seulement
    console.warn("[webhook/fedapay] Transaction refusée, id:", String(event.entity?.id))
  }

  // Toujours 200 - FedaPay ne doit pas retenter
  return new Response("OK", { status: 200 })
}
