import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/index"

// Route interne appelée par les Edge Functions Deno pour envoyer des emails.
// Protégée par un secret partagé pour éviter les appels non autorisés.

export async function POST(request) {
  const authHeader = request.headers.get("authorization")
  const expectedSecret = process.env.INTERNAL_API_SECRET

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  const { template, to, data } = body

  if (!template || !to) {
    return Response.json({ error: "template et to sont requis" }, { status: 400 })
  }

  const result = await sendEmail(template, to, data ?? {})

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 })
  }

  return Response.json({ success: true })
}
