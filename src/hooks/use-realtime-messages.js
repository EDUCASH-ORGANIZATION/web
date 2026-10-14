"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { MEDIA_BUCKET, createMediaRefresher, isPairRow, mergeMessages, toMessage } from "@/lib/client-space/conversations"

// Une adresse signée pour un message : null si l'action échoue ou ne connaît pas le message.
async function fetchMediaUrl(resolve, messageId) {
  try {
    const result = await resolve?.([messageId])
    const url = result?.media?.[messageId]
    return typeof url === "string" ? url : null
  } catch {
    return null
  }
}

/**
 * Messages d'une conversation (mission, étudiant) en temps réel, en lecture seule : les insertions de la
 * paire sont ajoutées sans doublon d'identifiant. L'envoi passe par l'action serveur (`append` ajoute le
 * message renvoyé). Le filtre du canal ne porte que sur la mission : les lignes d'une autre paire sont
 * écartées ici, et la sécurité de niveau ligne de la base ne livre de toute façon que les messages dont
 * l'utilisateur est expéditeur ou destinataire.
 *
 * Médias : la ligne reçue ne porte qu'un identifiant (`mediaPath`), jamais une adresse affichable. Le hook ne
 * signe pas lui-même : il appelle `resolveMedia(messageIds)` (action serveur) pour un média reçu, et
 * `refreshMedia(messageId)` re-signe UNE fois un média dont le chargement a échoué (adresse expirée) ; au second
 * échec le média est déclaré indisponible (adresse null), sans boucle.
 * Seul endroit client autorisé à importer `@/lib/supabase/client` pour la messagerie.
 *
 * @param {{ missionId: string, studentId: string, userId: string, initialMessages: object[], onIncoming?: (message: object) => void, resolveMedia?: (messageIds: string[]) => Promise<{ media?: Record<string, string|null>, error?: string }> }} options
 * @returns {{ messages: object[], append: (message: object) => void, refreshMedia: (messageId: string) => Promise<void> }}
 */
export function useRealtimeMessages({ missionId, studentId, userId, initialMessages, onIncoming, resolveMedia }) {
  const [supabase] = useState(() => createClient())
  // Messages reçus ou envoyés depuis le chargement ; fusionnés avec ceux du serveur à chaque rendu,
  // donc un rafraîchissement serveur ne fait rien perdre.
  const [live, setLive] = useState([])
  // Adresses (re)signées par identifiant de message, appliquées par-dessus les messages ; null = indisponible.
  const [urls, setUrls] = useState({})
  const merged = useMemo(() => mergeMessages(initialMessages, live), [initialMessages, live])
  const messages = useMemo(
    () => merged.map((m) => (Object.hasOwn(urls, m.id) ? { ...m, mediaUrl: urls[m.id] } : m)),
    [merged, urls],
  )
  const incomingRef = useRef(onIncoming)
  const resolveRef = useRef(resolveMedia)

  useEffect(() => {
    incomingRef.current = onIncoming
    resolveRef.current = resolveMedia
  })

  useEffect(() => {
    if (!missionId || !studentId || !userId) return undefined
    const channel = supabase
      .channel(`conversation:${missionId}:${studentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `mission_id=eq.${missionId}` },
        async (payload) => {
          const row = payload.new
          if (!row || row.mission_id !== missionId || !isPairRow(row, userId, studentId)) return
          let message = toMessage(row, userId)
          if (!message) return
          // Un média reçu n'est affiché qu'une fois signé (pas de bulle « indisponible » le temps de la signature).
          if (message.mediaPath && !message.mediaUrl) {
            const url = await fetchMediaUrl(resolveRef.current, message.id)
            message = { ...message, mediaUrl: url }
          }
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

  const refresherRef = useRef(null)
  const refreshMedia = useCallback((messageId) => {
    refresherRef.current ??= createMediaRefresher({
      fetchUrl: (id) => fetchMediaUrl(resolveRef.current, id),
      onUrl: (id, url) => setUrls((prev) => ({ ...prev, [id]: url })),
    })
    return refresherRef.current(messageId)
  }, [])

  return { messages, append, refreshMedia }
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
