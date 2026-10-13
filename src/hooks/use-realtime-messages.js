"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { MEDIA_BUCKET, isPairRow, mergeMessages, toMessage } from "@/lib/client-space/conversations"

/**
 * Messages d'une conversation (mission, étudiant) en temps réel, en lecture seule : les insertions de la
 * paire sont ajoutées sans doublon d'identifiant. L'envoi passe par l'action serveur (`append` ajoute le
 * message renvoyé). Le filtre du canal ne porte que sur la mission : les lignes d'une autre paire sont
 * écartées ici, et la sécurité de niveau ligne de la base ne livre de toute façon que les messages dont
 * l'utilisateur est expéditeur ou destinataire.
 * Seul endroit client autorisé à importer `@/lib/supabase/client` pour la messagerie client.
 *
 * @param {{ missionId: string, studentId: string, userId: string, initialMessages: object[], onIncoming?: (message: object) => void }} options
 * @returns {{ messages: object[], append: (message: object) => void }}
 */
export function useRealtimeMessages({ missionId, studentId, userId, initialMessages, onIncoming }) {
  const [supabase] = useState(() => createClient())
  // Messages reçus ou envoyés depuis le chargement ; fusionnés avec ceux du serveur à chaque rendu,
  // donc un rafraîchissement serveur ne fait rien perdre.
  const [live, setLive] = useState([])
  const messages = useMemo(() => mergeMessages(initialMessages, live), [initialMessages, live])
  const incomingRef = useRef(onIncoming)

  useEffect(() => {
    incomingRef.current = onIncoming
  })

  useEffect(() => {
    if (!missionId || !studentId || !userId) return undefined
    const channel = supabase
      .channel(`client_conversation:${missionId}:${studentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `mission_id=eq.${missionId}` },
        (payload) => {
          const row = payload.new
          if (!row || row.mission_id !== missionId || !isPairRow(row, userId, studentId)) return
          const message = toMessage(row, userId)
          if (!message) return
          setLive((prev) => mergeMessages(prev, [message]))
          if (!message.mine) incomingRef.current?.(message)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, missionId, studentId, userId])

  const append = useCallback((message) => {
    setLive((prev) => mergeMessages(prev, [message]))
  }, [])

  return { messages, append }
}

const EXTENSION = /^[a-z0-9]{1,5}$/

/**
 * Téléverse un fichier du navigateur vers `message-media/<userId>/...` et renvoie le chemin (jamais
 * l'adresse publique : l'action serveur la reconstruit après avoir contrôlé le chemin).
 * @param {string} userId identifiant de la session, premier segment du chemin
 * @returns {(blob: Blob, extension: string) => Promise<string>}
 */
export function useMessageMediaUpload(userId) {
  const [supabase] = useState(() => createClient())
  return useCallback(
    async (blob, extension) => {
      const ext = EXTENSION.test(extension) ? extension : "bin"
      const unique =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
      const path = `${userId}/${Date.now()}-${unique}.${ext}`
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob)
      if (error) throw new Error("upload")
      return path
    },
    [supabase, userId],
  )
}
