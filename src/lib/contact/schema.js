import { z } from "zod"

export const CONTACT_SUBJECTS = [
  { id: "question", label: "Question sur une mission" },
  { id: "paiement", label: "Paiement, séquestre ou retrait" },
  { id: "verification", label: "Vérification de ma carte" },
  { id: "signalement", label: "Problème avec un compte" },
  { id: "partenariat", label: "Partenariat ou presse" },
  { id: "autre", label: "Autre" },
]

export const CONTACT_LIMITS = { nameMax: 80, emailMax: 254, messageMin: 10, messageMax: 1000 }

export const HONEYPOT_FIELD = "website"

const SUBJECT_IDS = CONTACT_SUBJECTS.map((s) => s.id)

export const contactSchema = z.object({
  name: z
    .string()
    .transform((v) => v.replace(/[\r\n]+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, "Indique ton nom.")
        .max(CONTACT_LIMITS.nameMax, `Ton nom ne doit pas dépasser ${CONTACT_LIMITS.nameMax} caractères.`)
    ),
  email: z
    .string()
    .trim()
    .max(CONTACT_LIMITS.emailMax, "L'adresse email est trop longue.")
    .pipe(z.email("L'adresse email n'est pas valide.")),
  subject: z.enum(SUBJECT_IDS, { error: "Choisis un sujet." }),
  message: z
    .string()
    .trim()
    .min(CONTACT_LIMITS.messageMin, `Ton message doit faire au moins ${CONTACT_LIMITS.messageMin} caractères.`)
    .max(CONTACT_LIMITS.messageMax, `Ton message ne doit pas dépasser ${CONTACT_LIMITS.messageMax} caractères.`),
})

function field(formData, key) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

/**
 * @param {FormData} formData
 * @returns {{ ok: true, data: z.infer<typeof contactSchema> }
 *   | { ok: false, fieldErrors: Record<string, string> }
 *   | { ok: false, spam: true }}
 */
export function parseContactForm(formData) {
  if (field(formData, HONEYPOT_FIELD).trim() !== "") {
    return { ok: false, spam: true }
  }

  const result = contactSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    subject: field(formData, "subject"),
    message: field(formData, "message"),
  })

  if (result.success) return { ok: true, data: result.data }

  const fieldErrors = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0])
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message
  }
  return { ok: false, fieldErrors }
}
