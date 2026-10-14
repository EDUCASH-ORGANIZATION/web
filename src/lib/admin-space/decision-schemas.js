// @ds-screen RD-ADMIN-01
// Schémas des décisions admin (refus, motifs libres, identifiants). Pur : aucun accès aux données.
import { z } from "zod"

export const OTHER_REASON = "Autre motif"

export const ADMIN_REJECTION_REASONS = [
  "Photo floue ou illisible",
  "Carte d'une année passée",
  "Nom différent de celui du profil",
  "Ce n'est pas une carte étudiante",
  "Établissement non reconnu",
  "Coins coupés ou recto manquant",
  OTHER_REASON,
]

export const MESSAGE_MAX = 500
export const REASON_MIN = 5
export const REASON_MAX = 500

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

/** Retire les caractères de contrôle et normalise les espaces. */
export function cleanFreeText(value) {
  return String(value ?? "").replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim()
}

export const uuidSchema = z
  .string({ error: "Identifiant invalide." })
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Identifiant invalide.")

/** Motif libre obligatoire (réinitialiser, révoquer, suspendre, réactiver) : 5 à 500 caractères. */
export const reasonSchema = z
  .string({ error: "Indiquez un motif." })
  .transform(cleanFreeText)
  .pipe(
    z
      .string()
      .min(REASON_MIN, `Le motif doit contenir au moins ${REASON_MIN} caractères.`)
      .max(REASON_MAX, `Le motif ne peut pas dépasser ${REASON_MAX} caractères.`),
  )

/** Refus d'une carte : motif de la liste fermée, message facultatif (obligatoire pour « Autre motif »). */
export const rejectSchema = z
  .object({
    reason: z.enum(ADMIN_REJECTION_REASONS, { error: "Choisissez un motif de la liste." }),
    message: z
      .string({ error: "Message invalide." })
      .transform(cleanFreeText)
      .pipe(z.string().max(MESSAGE_MAX, `Le message ne peut pas dépasser ${MESSAGE_MAX} caractères.`))
      .optional()
      .default(""),
  })
  .superRefine((value, ctx) => {
    if (value.reason === OTHER_REASON && value.message === "") {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Précisez le motif du refus." })
    }
  })
