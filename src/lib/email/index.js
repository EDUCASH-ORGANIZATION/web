"use server"

import { Resend } from "resend"
import WelcomeStudent from "./templates/welcome-student.jsx"
import WelcomeVerified from "./templates/welcome-verified.jsx"
import NewApplication from "./templates/new-application.jsx"
import ApplicationAccepted from "./templates/application-accepted.jsx"
import ApplicationRejected from "./templates/application-rejected.jsx"
import PaymentReceived from "./templates/payment-received.jsx"
import VerificationRejected from "./templates/verification-rejected.jsx"

const resend = new Resend(process.env.RESEND_API_KEY)

const TEMPLATES = {
  "welcome-student": WelcomeStudent,
  "welcome-verified": WelcomeVerified,
  "new-application": NewApplication,
  "application-accepted": ApplicationAccepted,
  "application-rejected": ApplicationRejected,
  "payment-received": PaymentReceived,
  "verification-rejected": VerificationRejected,
}

/**
 * @param {string} template
 * @param {string | string[]} to
 * @param {Record<string, unknown>} data
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function sendEmail(template, to, data = {}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY manquant — email non envoyé:", template)
    return { error: "RESEND_API_KEY non configuré" }
  }

  const Template = TEMPLATES[template]
  if (!Template) {
    console.warn("[email] Template inconnu:", template)
    return { error: "Template inconnu : " + template }
  }

  const subjects = {
    "welcome-student": "Bienvenue sur EduCash 🎓",
    "new-application": "Nouvelle candidature pour votre mission",
    "application-accepted": "Bonne nouvelle ! Vous avez été sélectionné(e) 🎉",
    "application-rejected": "Mise à jour de votre candidature",
    "payment-received": `Paiement reçu : ${data.amount ?? ""} FCFA 💰`,
    "welcome-verified": "Votre profil a été vérifié ✓",
    "verification-rejected": "Mise à jour de votre vérification",
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "EduCash <noreply@educash.bj>",
      to,
      subject: subjects[template],
      react: Template(data),
    })

    if (error) {
      console.error("[email] Erreur Resend:", error)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error("[email] Exception:", err)
    return { error: err?.message ?? "Erreur inconnue" }
  }
}
