import { timingSafeEqual } from "crypto"
import { sendEmail } from "@/lib/email/index"

// Route interne appelée par les Edge Functions Deno pour envoyer des emails.
// Fermée par défaut : sans INTERNAL_API_SECRET, aucun envoi n'est possible.

const ALLOWED_TEMPLATES = new Set([
  "welcome-student",
  "welcome-verified",
  "new-application",
  "application-accepted",
  "application-rejected",
  "payment-received",
  "wallet-deposited",
  "payment-received-wallet",
  "verification-approved",
  "verification-rejected",
  "verification-expired",
  "contact-message",
])

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

function isAuthorized(authHeader, secret) {
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authHeader ?? "")
  if (received.length !== expected.length) return false
  return timingSafeEqual(received, expected)
}

export async function POST(request) {
  const expectedSecret = process.env.INTERNAL_API_SECRET

  if (!expectedSecret) {
    console.error("[api/email] INTERNAL_API_SECRET non configuré - route désactivée")
    return new Response("Service Unavailable", { status: 503 })
  }

  if (!isAuthorized(request.headers.get("authorization"), expectedSecret)) {
    return new Response("Unauthorized", { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  const { template, to, data } = body ?? {}

  if (typeof template !== "string" || !ALLOWED_TEMPLATES.has(template)) {
    return Response.json({ error: "template invalide" }, { status: 400 })
  }

  if (typeof to !== "string" || !EMAIL_RE.test(to.trim())) {
    return Response.json({ error: "to invalide" }, { status: 400 })
  }

  const safeData = data && typeof data === "object" && !Array.isArray(data) ? data : {}

  const result = await sendEmail(template, to.trim(), safeData)

  if (result.error) {
    console.error("[api/email] échec d'envoi:", template)
    return Response.json({ error: "Envoi impossible" }, { status: 500 })
  }

  return Response.json({ success: true })
}
