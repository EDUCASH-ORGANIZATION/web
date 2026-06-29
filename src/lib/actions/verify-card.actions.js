"use server"

import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Vérifie via GPT-4o Vision si l'image uploadée est bien une carte étudiante.
 * L'image est d'abord récupérée depuis Supabase Storage (signed URL),
 * puis envoyée à GPT-4o en base64.
 *
 * @param {string} storagePath - Chemin dans le bucket student-cards (ex: "userId/card.jpg")
 * @returns {{ valid: boolean, reason: string }}
 */
export async function verifyStudentCardWithAI(storagePath) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return { valid: true, reason: "Vérification IA désactivée (clé manquante)." }
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { valid: false, reason: "Non authentifié." }

    // Génère une signed URL temporaire pour accéder à l'image privée
    const { data: signed, error: signErr } = await supabase.storage
      .from("student-cards")
      .createSignedUrl(storagePath, 60)

    if (signErr || !signed?.signedUrl) {
      return { valid: false, reason: "Impossible d'accéder à l'image uploadée." }
    }

    // Télécharge l'image et la convertit en base64
    const imgResponse = await fetch(signed.signedUrl)
    if (!imgResponse.ok) {
      return { valid: false, reason: "Impossible de télécharger l'image." }
    }

    const contentType = imgResponse.headers.get("content-type") || "image/jpeg"
    const arrayBuffer = await imgResponse.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    const dataUrl = `data:${contentType};base64,${base64}`

    // Appel GPT-4o Vision
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Tu es un système de vérification de documents pour une plateforme étudiante au Bénin (Afrique de l'Ouest).

Analyse cette image et détermine si c'est une carte étudiante valide.

Une carte étudiante valide doit contenir AU MOINS 2 des éléments suivants :
- Un nom d'étudiant lisible
- Le nom d'une université, école ou établissement d'enseignement
- Une photo d'identité
- Une année académique ou date de validité
- Un numéro d'étudiant ou matricule
- Un logo ou sceau d'établissement

Réponds UNIQUEMENT avec ce format JSON strict, rien d'autre :
{"valid": true, "reason": "Carte étudiante détectée : [éléments trouvés]"}
ou
{"valid": false, "reason": "Ce n'est pas une carte étudiante : [ce qui est visible à la place]"}`,
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "low" },
            },
          ],
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ""

    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed.valid === "boolean" && typeof parsed.reason === "string") {
        return parsed
      }
    } catch {
      // GPT n'a pas retourné du JSON valide — on laisse passer (fail-open)
      console.warn("[verifyStudentCardWithAI] Réponse GPT non-JSON :", raw)
      return { valid: true, reason: "Vérification inconcluante — examen manuel requis." }
    }

    return { valid: true, reason: "Vérification inconcluante — examen manuel requis." }
  } catch (err) {
    console.error("[verifyStudentCardWithAI]", err)
    // Fail-open : en cas d'erreur API, on laisse passer et l'admin vérifie
    return { valid: true, reason: "Erreur IA — examen manuel requis." }
  }
}
