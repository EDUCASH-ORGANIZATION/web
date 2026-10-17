"use client"

import { useCallback, useState } from "react"
import { PROOF_BUCKET, proofPath, validateProofFile } from "@/lib/purchases/proofs"
import { createClient } from "@/lib/supabase/client"

export const PROOF_UPLOAD_ERROR = "La photo n'a pas pu être téléversée. Vérifiez votre connexion et réessayez : vos informations sont conservées."
export const PROOF_NAME_ERROR = "La photo n'a pas pu être préparée. Choisissez-en une autre."

// Jeton aléatoire du nom d'une preuve (lettres minuscules et chiffres, 8 à 40) : le chemin n'est pas devinable.
function proofToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().replaceAll("-", "")
  return Math.random().toString(36).slice(2).padEnd(12, "0")
}

/**
 * Téléverse une preuve d'une demande de paiement d'achats vers `purchase-proofs/<ownerId>/<requestId>/<nature>-<jeton>.<ext>`
 * avec la session du navigateur (la politique de stockage n'accepte que le dossier de l'appelant). `upsert: false` : une
 * preuve déjà déposée n'est jamais écrasée, chaque envoi prend un nouveau jeton. Le chemin renvoyé est ensuite contrôlé
 * par l'action serveur ; l'adresse publique n'existe pas (compartiment privé). Ne lève jamais.
 * @param {string} ownerId identifiant de la session, premier segment du chemin
 * @returns {(input: { requestId: string, kind: "payee"|"ticket"|"sms", file: Blob & { name?: string } }) => Promise<{ path: string } | { error: string }>}
 */
export function usePurchaseProofUpload(ownerId) {
  const [supabase] = useState(() => createClient())
  return useCallback(
    async ({ requestId, kind, file }) => {
      const verdict = validateProofFile(file)
      if (!verdict.ok) return { error: verdict.error }
      const path = proofPath({ ownerId, requestId, kind, extension: verdict.extension, token: proofToken() })
      if (!path) return { error: PROOF_NAME_ERROR }
      try {
        const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined })
        if (error) return { error: PROOF_UPLOAD_ERROR }
      } catch {
        return { error: PROOF_UPLOAD_ERROR }
      }
      return { path }
    },
    [supabase, ownerId],
  )
}
