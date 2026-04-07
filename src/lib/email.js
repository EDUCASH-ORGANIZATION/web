"use server"

/**
 * Envoie un email transactionnel via Resend.
 *
 * @param {'new-application' | 'application-accepted' | 'application-rejected'} template
 * @param {string} to
 * @param {Record<string, string | number>} variables
 * @returns {Promise<void>}
 */
export async function sendEmail(template, to, variables = {}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY manquant — email non envoyé")
    return
  }

  const templates = {
    "new-application": {
      subject: `Nouvelle candidature pour votre mission "${variables.missionTitle}"`,
      html: `
        <p>Bonjour,</p>
        <p><strong>${variables.studentName}</strong> a postulé à votre mission
           <strong>${variables.missionTitle}</strong>.</p>
        <p><em>"${variables.message}"</em></p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/client/missions/${variables.missionId}">
          Voir les candidatures →
        </a></p>
      `,
    },
    "application-accepted": {
      subject: `Votre candidature a été acceptée — ${variables.missionTitle}`,
      html: `
        <p>Bonjour ${variables.studentName},</p>
        <p>Félicitations ! Votre candidature pour la mission
           <strong>${variables.missionTitle}</strong> a été <strong>acceptée</strong>.</p>
        <p>Le client va vous contacter prochainement.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/missions/${variables.missionId}">
          Voir la mission →
        </a></p>
      `,
    },
    "application-rejected": {
      subject: `Candidature non retenue — ${variables.missionTitle}`,
      html: `
        <p>Bonjour ${variables.studentName},</p>
        <p>Nous vous informons que votre candidature pour la mission
           <strong>${variables.missionTitle}</strong> n'a pas été retenue.</p>
        <p>Ne vous découragez pas — d'autres missions vous attendent !</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/missions">
          Explorer les missions →
        </a></p>
      `,
    },
  }

  const tpl = templates[template]
  if (!tpl) {
    console.warn(`[email] Template inconnu : ${template}`)
    return
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EduCash <noreply@educash.bj>",
        to,
        subject: tpl.subject,
        html: tpl.html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[email] Erreur Resend (${res.status}):`, err)
    }
  } catch (err) {
    // Ne jamais faire crasher l'action à cause d'un email
    console.error("[email] Erreur réseau Resend:", err)
  }
}
