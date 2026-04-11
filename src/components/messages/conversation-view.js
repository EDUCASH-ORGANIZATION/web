"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { SendHorizonal, Loader2, ChevronLeft, CreditCard } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { MessageBubble } from "@/components/messages/message-bubble"
import { VerifiedAvatar } from "@/components/shared/verified-avatar"

/**
 * @param {{
 *   initialMessages: object[],
 *   missionId: string,
 *   currentUserId: string,
 *   interlocuteur: {
 *     user_id: string,
 *     full_name: string,
 *     avatar_url: string | null,
 *     is_verified?: boolean,
 *     verified_until?: string | null,
 *   },
 *   missionTitle: string,
 *   missionStatus: string,
 *   userRole: 'student' | 'client'
 * }} props
 */
export function ConversationView({
  initialMessages,
  missionId,
  currentUserId,
  interlocuteur,
  missionTitle,
  missionStatus,
  userRole,
}) {
  const router   = useRouter()
  const supabase = useRef(createClient()).current

  const [messages,    setMessages]    = useState(initialMessages)
  const [newMessage,  setNewMessage]  = useState("")
  const [isSending,   setIsSending]   = useState(false)
  const bottomRef    = useRef(null)
  const channelRef   = useRef(null)
  const textareaRef  = useRef(null)

  // Scroll automatique vers le bas quand les messages changent
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Realtime : écoute les nouveaux messages de cette conversation ──────────
  useEffect(() => {
    channelRef.current = supabase
      .channel(`conv:${missionId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "messages",
          filter: `mission_id=eq.${missionId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Évite les doublons (le message qu'on vient d'envoyer)
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelRef.current)
    }
  }, [missionId, supabase])

  // ── Marque les messages reçus comme lus ───────────────────────────────────
  useEffect(() => {
    supabase
      .from("messages")
      .update({ read: true })
      .eq("mission_id", missionId)
      .eq("receiver_id", currentUserId)
      .eq("read", false)
      .then(() => {})
  }, [missionId, currentUserId, supabase])

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  function handleTextareaChange(e) {
    setNewMessage(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 120) + "px"
    }
  }

  // ── Envoi d'un message ────────────────────────────────────────────────────
  async function sendMessage() {
    const content = newMessage.trim()
    if (!content || isSending) return

    setIsSending(true)

    const { data: inserted } = await supabase
      .from("messages")
      .insert({
        mission_id:  missionId,
        sender_id:   currentUserId,
        receiver_id: interlocuteur.user_id,
        content,
        read: false,
      })
      .select()
      .single()

    // On ajoute localement sans attendre le realtime (UX plus rapide)
    if (inserted) {
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
      )
    }

    setNewMessage("")
    setIsSending(false)

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const backHref = userRole === "client" ? "/client/messages" : "/messages"
  const payHref  = `/client/payment/${missionId}`

  const interlocuteurIsVerified  = interlocuteur?.is_verified   ?? false
  const interlocuteurVerifiedUntil = interlocuteur?.verified_until ?? null

  // Datestamp séparateur — affiche la date quand le jour change entre deux messages
  function getDateLabel(msg, idx) {
    if (idx === 0) return formatDayLabel(msg.created_at)
    const prev = messages[idx - 1]
    const d1 = new Date(msg.created_at).toDateString()
    const d2 = new Date(prev.created_at).toDateString()
    return d1 !== d2 ? formatDayLabel(msg.created_at) : null
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">

      {/* ── Header sticky ─────────────────────────────────────────────── */}
      <header className="sticky top-0 bg-white border-b border-gray-100 z-10 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors touch-manipulation"
          aria-label="Retour"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Avatar interlocuteur avec badge de vérification */}
        <VerifiedAvatar
          avatarUrl={interlocuteur?.avatar_url ?? null}
          fullName={interlocuteur?.full_name ?? ""}
          isVerified={interlocuteurIsVerified}
          verifiedUntil={interlocuteurVerifiedUntil}
          size="sm"
          showBadge
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {interlocuteur?.full_name ?? "Interlocuteur"}
            </p>
          </div>
          <p className="text-xs text-gray-500 truncate">{missionTitle}</p>
        </div>
      </header>

      {/* ── Barre "Confirmer et payer" (client, mission en cours) ─────── */}
      {missionStatus === "in_progress" && userRole === "client" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-800">
            Mission en cours. Confirmez la fin pour procéder au paiement.
          </p>
          <button
            type="button"
            onClick={() => router.push(payHref)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors touch-manipulation"
          >
            <CreditCard size={12} />
            Confirmer et payer →
          </button>
        </div>
      )}

      {/* ── Zone de messages ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 text-center px-8">
              Aucun message pour l&apos;instant. Démarrez la conversation !
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const dayLabel = getDateLabel(msg, idx)
            return (
              <div key={msg.id}>
                {dayLabel && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[11px] text-gray-400 font-medium shrink-0">
                      {dayLabel}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}
                <MessageBubble message={msg} currentUserId={currentUserId} />
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Zone de saisie ────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-white px-3 py-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="Écris un message… (Entrée pour envoyer)"
          rows={1}
          disabled={isSending}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] disabled:opacity-60 overflow-hidden leading-relaxed transition-colors"
          style={{ minHeight: "42px", maxHeight: "120px" }}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!newMessage.trim() || isSending}
          className="w-10 h-10 rounded-xl bg-[#1A6B4A] text-white flex items-center justify-center hover:bg-[#155a3d] active:bg-[#104530] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 touch-manipulation"
          aria-label="Envoyer"
        >
          {isSending
            ? <Loader2 size={16} className="animate-spin" />
            : <SendHorizonal size={16} />
          }
        </button>
      </div>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDayLabel(iso) {
  const date = new Date(iso)
  const now  = new Date()

  const isToday     = date.toDateString() === now.toDateString()
  const yesterday   = new Date(now); yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  if (isToday)     return "Aujourd'hui"
  if (isYesterday) return "Hier"

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  }).format(date)
}
