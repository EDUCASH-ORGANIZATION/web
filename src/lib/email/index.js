"use server"

import { Resend } from "resend"
import WelcomeStudent        from "./templates/welcome-student.jsx"
import WelcomeVerified       from "./templates/welcome-verified.jsx"
import NewApplication        from "./templates/new-application.jsx"
import ApplicationAccepted   from "./templates/application-accepted.jsx"
import ApplicationRejected   from "./templates/application-rejected.jsx"
import PaymentReceived       from "./templates/payment-received.jsx"
import WalletDeposited         from "./templates/wallet-deposited.jsx"
import PaymentReceivedWallet   from "./templates/payment-received-wallet.jsx"
import VerificationApproved    from "./templates/verification-approved.jsx"
import VerificationRejected  from "./templates/verification-rejected.jsx"
import VerificationExpired   from "./templates/verification-expired.jsx"

const resend = new Resend(process.env.RESEND_API_KEY)

const TEMPLATES = {
  "welcome-student":        WelcomeStudent,
  "welcome-verified":       WelcomeVerified,
  "new-application":        NewApplication,
  "application-accepted":   ApplicationAccepted,
  "application-rejected":   ApplicationRejected,
  "payment-received":       PaymentReceived,
  "wallet-deposited":           WalletDeposited,
  "payment-received-wallet":    PaymentReceivedWallet,
  "verification-approved":      VerificationApproved,
  "verification-rejected":  VerificationRejected,
  "verification-expired":   VerificationExpired,
}

const SUBJECTS = {
  "welcome-student":        "Bienvenue sur EduCash 🎓",
  "welcome-verified":       "Votre profil a été vérifié ✓",
  "new-application":        "Nouvelle candidature pour votre mission",
  "application-accepted":   "Bonne nouvelle ! Vous avez été sélectionné(e) 🎉",
  "application-rejected":   "Mise à jour de votre candidature",
  "verification-approved":  "Ton profil EduCash est vérifié ✓",
  "verification-rejected":  "Action requise sur ton dossier EduCash",
  "verification-expired":   "Ton badge EduCash a expiré — renouvelle-le",
  "wallet-deposited":           "Votre wallet a été rechargé ✓",
  "payment-received-wallet":    "Paiement reçu dans votre wallet 💰",
}

/**
 * Envoie un email via Resend en utilisant un template React Email.
 *
 * @param {keyof typeof TEMPLATES} template
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

  const subject =
    template === "payment-received"
      ? `Paiement reçu : ${data.amount ?? ""} FCFA 💰`
      : template === "wallet-deposited"
        ? `Votre wallet a été rechargé — ${data.amount ?? ""} FCFA ✓`
        : template === "payment-received-wallet"
          ? `Paiement reçu — ${data.amount ?? ""} FCFA dans votre wallet 💰`
          : SUBJECTS[template]

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "EduCash <noreply@educash.bj>",
      to,
      subject,
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
