"use server"

import { sendEmail } from "@/lib/email/index"
import { CONTACT_SUBJECTS, parseContactForm } from "@/lib/contact/schema"

const DEFAULT_INBOX = "contact@educash.bj"

/**
 * @param {FormData} formData
 * @returns {Promise<
 *   { status: "success" }
 *   | { status: "invalid", fieldErrors: Record<string, string> }
 *   | { status: "error", message: string }
 * >}
 */
export async function sendContactMessage(formData) {
  const parsed = parseContactForm(formData)

  if (parsed.spam) return { status: "success" }
  if (!parsed.ok) return { status: "invalid", fieldErrors: parsed.fieldErrors }

  const { name, email, subject, message } = parsed.data
  const subjectLabel = CONTACT_SUBJECTS.find((s) => s.id === subject).label
  const to = process.env.CONTACT_INBOX_EMAIL || DEFAULT_INBOX

  const result = await sendEmail(
    "contact-message",
    to,
    { name, email, subjectLabel, message },
    { replyTo: email, subject: `Contact EduCash : ${subjectLabel}` }
  )

  if (result?.error) {
    console.error("[contact] send failed", { code: "send_error" })
    return { status: "error", message: "L'envoi a échoué. Ton message est conservé, réessaie dans un instant." }
  }

  return { status: "success" }
}
