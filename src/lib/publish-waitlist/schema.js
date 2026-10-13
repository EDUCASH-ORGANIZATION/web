import { z } from "zod"
import { HONEYPOT_FIELD } from "@/lib/contact/schema"

export { HONEYPOT_FIELD }

export const WAITLIST_EMAIL_MAX = 254

export const waitlistSchema = z.object({
  email: z
    .string({ error: "Saisissez votre adresse email." })
    .trim()
    .min(1, "Saisissez votre adresse email.")
    .max(WAITLIST_EMAIL_MAX, "Cette adresse email est trop longue.")
    .pipe(z.email("Cette adresse email n'est pas valide.")),
})

function field(formData, key) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

/**
 * @param {FormData} formData
 * @returns {{ ok: true, data: { email: string } }
 *   | { ok: false, fieldErrors: Record<string, string> }
 *   | { ok: false, spam: true }}
 */
export function parseWaitlistForm(formData) {
  if (field(formData, HONEYPOT_FIELD).trim() !== "") return { ok: false, spam: true }

  const result = waitlistSchema.safeParse({ email: field(formData, "email") })
  if (result.success) return { ok: true, data: { email: result.data.email } }

  const fieldErrors = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "email")
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message
  }
  return { ok: false, fieldErrors }
}
