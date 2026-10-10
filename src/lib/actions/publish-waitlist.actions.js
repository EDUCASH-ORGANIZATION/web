"use server"

import { headers } from "next/headers"
import { sendEmail } from "@/lib/email/index"
import { parseWaitlistForm } from "@/lib/publish-waitlist/schema"
import { WAITLIST_LIMITS, isRateLimited } from "@/lib/publish-waitlist/rate-limit"

const DEFAULT_INBOX = "contact@educash.bj"
const SUBJECT = "Prévenez-moi : ouverture de la publication"

async function callerKey() {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || h.get("x-real-ip") || "unknown"
}

/**
 * Formulaire « Prévenez-moi » de la publication en pause : l'email est transmis à la boîte de
 * contact (aucun stockage, aucun compte requis). Un honeypot rempli répond comme un succès.
 * @param {object | null} _prevState
 * @param {FormData} formData
 * @returns {Promise<{ status?: "sent", fieldErrors?: Record<string, string>, formError?: string, code?: "rate_limited" | "send_failed" }>}
 */
export async function notifyPublishOpening(_prevState, formData) {
  const parsed = parseWaitlistForm(formData)
  if (parsed.spam) return { status: "sent" }
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors }

  const { email } = parsed.data
  const ip = await callerKey()
  if (
    isRateLimited(`ip:${ip}`, WAITLIST_LIMITS.perIp) ||
    isRateLimited(`email:${email.toLowerCase()}`, WAITLIST_LIMITS.perEmail)
  ) {
    return { code: "rate_limited", formError: "Trop de demandes. Réessayez dans quelques minutes." }
  }

  const to = process.env.CONTACT_INBOX_EMAIL || DEFAULT_INBOX
  const result = await sendEmail(
    "contact-message",
    to,
    {
      name: "Prévenez-moi",
      email,
      subjectLabel: SUBJECT,
      message: "Cette personne souhaite être prévenue de l'ouverture de la publication de missions.",
    },
    { replyTo: email, subject: SUBJECT }
  )

  if (result?.error) {
    console.error("[publish-waitlist] send failed", { code: "send_error" })
    return { code: "send_failed", formError: "L'envoi a échoué. Réessayez dans un instant." }
  }

  return { status: "sent" }
}
