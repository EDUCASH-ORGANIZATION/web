import { createClient } from "@supabase/supabase-js"
import { createHmac } from "crypto"

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

  if (event.name === "transaction.approved") {
    const fedapayId = event.entity.id.toString()

    // Met à jour la transaction
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("fedapay_id", fedapayId)
      .select()
      .single()

    if (txError || !transaction) {
      console.error("[webhook/fedapay] Transaction introuvable pour fedapay_id:", fedapayId, txError)
      return new Response("OK", { status: 200 }) // Toujours 200 pour éviter les retries inutiles
    }

    // Met à jour la mission
    const { data: mission } = await supabase
      .from("missions")
      .update({ status: "done" })
      .eq("id", transaction.mission_id)
      .select("title, selected_student_id")
      .single()

    // Récupère l'email de l'étudiant via auth.users (service role requis)
    if (mission?.selected_student_id) {
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
          studentName: studentProfile?.full_name ?? "Étudiant",
          amount: new Intl.NumberFormat("fr-FR").format(transaction.amount_student),
          missionTitle: mission.title,
          paidAt: transaction.paid_at,
        })
      }
    }
  }

  if (event.name === "transaction.declined") {
    const fedapayId = event.entity.id.toString()

    const { error } = await supabase
      .from("transactions")
      .update({ status: "failed" })
      .eq("fedapay_id", fedapayId)

    if (error) {
      console.error("[webhook/fedapay] Impossible de mettre à jour transaction declined:", error)
    }
  }

  return new Response("OK", { status: 200 })
}
