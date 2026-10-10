import { audienceFor } from "@/lib/auth/destinations"

/**
 * Public d'un formulaire d'auth, pour choisir le ton des messages (tutoiement étudiant, vouvoiement client).
 * Champ `audience` ou `role` explicite (student | client), sinon `next` sous /client, sinon client
 * (vouvoiement neutre : l'accueil parle aux clients).
 * @param {FormData} formData
 * @returns {"student" | "client"}
 */
export function formAudience(formData) {
  const explicit = formData.get("audience")?.toString() || formData.get("role")?.toString()
  if (explicit === "student" || explicit === "client") return explicit
  return audienceFor({ next: formData.get("next")?.toString() }, "client")
}
