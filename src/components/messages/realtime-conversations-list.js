"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ConversationItem } from "@/components/messages/conversation-item"

/**
 * Liste de conversations avec mise à jour realtime.
 *
 * - Met à jour lastMessage / lastMessageAt / unreadCount quand un nouveau
 *   message arrive pour cet utilisateur.
 * - Appelle router.refresh() si une toute nouvelle conversation apparaît
 *   (mission inconnue → besoin de recharger le titre depuis le serveur).
 *
 * @param {{
 *   initialConversations: object[],
 *   currentUserId: string,
 *   role: 'student' | 'client',
 *   emptyTitle: string,
 *   emptyMessage: string,
 *   emptyCtaLabel: string,
 *   emptyCtaHref: string,
 * }} props
 */
export function RealtimeConversationsList({
  initialConversations,
  currentUserId,
  role,
  emptyTitle,
  emptyMessage,
  emptyCtaLabel,
  emptyCtaHref,
}) {
  const router   = useRouter()
  const supabase = useRef(createClient()).current
  const [conversations, setConversations] = useState(initialConversations)

  useEffect(() => {
    const channel = supabase
      .channel(`inbox:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const msg = payload.new
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.missionId === msg.mission_id)

            if (idx !== -1) {
              // Conversation existante → on met à jour
              const updated = prev.map((c, i) =>
                i === idx
                  ? {
                      ...c,
                      lastMessage:   msg.content,
                      lastMessageAt: msg.created_at,
                      unreadCount:   c.unreadCount + 1,
                    }
                  : c
              )
              // Remonte la conversation mise à jour en premier
              updated.sort(
                (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
              )
              return updated
            }

            // Nouvelle conversation inconnue → rafraîchit le Server Component
            // pour récupérer le titre de la mission depuis la base
            router.refresh()
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, supabase, router])

  // Resync depuis le serveur après navigation (marque comme lu, etc.)
  useEffect(() => {
    setConversations(initialConversations)
  }, [initialConversations])

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <MessageSquare size={28} className="text-gray-300" />
        </div>
        <p className="text-sm font-bold text-gray-700">{emptyTitle}</p>
        <p className="text-xs text-gray-400 mt-1.5 max-w-xs">{emptyMessage}</p>
        {emptyCtaLabel && emptyCtaHref && (
          <a
            href={emptyCtaHref}
            className="mt-5 px-5 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors"
          >
            {emptyCtaLabel}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {conversations.map((conv) => (
        <ConversationItem key={conv.missionId} conversation={conv} role={role} />
      ))}
    </div>
  )
}
