import { audienceFor } from "@/lib/auth/destinations"

/**
 * Public d'un formulaire d'auth (parcours et panneau visuel). Ne sert plus au ton : tous les messages sont vouvoyés.
 * Champ `audience` ou `role` explicite (student | client), sinon `next` sous /client, sinon client
 * (l'accueil parle aux clients).
 * @param {FormData} formData
 * @returns {"student" | "client"}
 */
export function formAudience(formData) {
  const explicit = formData.get("audience")?.toString() || formData.get("role")?.toString()
  if (explicit === "student" || explicit === "client") return explicit
  return audienceFor({ next: formData.get("next")?.toString() }, "client")
}
