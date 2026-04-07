"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { SendHorizonal, Loader2, ChevronLeft, CreditCard } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { MessageBubble } from "@/components/messages/message-bubble"

/**
 * @param {{
 *   initialMessages: object[],
 *   missionId: string,
 *   currentUserId: string,
 *   interlocuteur: { user_id: string, full_name: string, avatar_url: string | null },
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
  const router = useRouter()
  const supabase = createClient()

  const [messages, setMessages] = useState(initialMessages)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef(null)
  const channelRef = useRef(null)
  const textareaRef = useRef(null)

  // Scroll automatique quand les messages changent
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Realtime — écoute les nouveaux messages de cette conversation
  useEffect(() => {
    channelRef.current = supabase
      .channel(`messages:${missionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `mission_id=eq.${missionId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Évite les doublons si l'insert vient de nous-mêmes
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelRef.current)
    }
  }, [missionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Marque les messages reçus comme lus
  useEffect(() => {
    supabase
      .from("messages")
      .update({ read: true })
      .eq("mission_id", missionId)
      .eq("receiver_id", currentUserId)
      .eq("read", false)
      .then(() => {})
  }, [missionId, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize du textarea
  function handleTextareaChange(e) {
    setNewMessage(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 120) + "px"
    }
  }

  async function sendMessage() {
    const content = newMessage.trim()
    if (!content || isSending) return

    setIsSending(true)

    await supabase.from("messages").insert({
      mission_id: missionId,
      sender_id: currentUserId,
      receiver_id: interlocuteur.user_id,
      content,
      read: false,
    })

    setNewMessage("")
    setIsSending(false)

    // Reset textarea height
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

  const interlocuteurInitial = interlocuteur?.full_name?.charAt(0)?.toUpperCase() ?? "?"
  const backHref = userRole === "client" ? "/client/messages" : "/messages"
  const payHref = `/client/payment/${missionId}`

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">

      {/* Header sticky */}
      <header className="sticky top-0 bg-white border-b border-gray-100 z-10 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors touch-manipulation"
          aria-label="Retour"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Avatar interlocuteur */}
        <div className="w-9 h-9 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
          {interlocuteur?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={interlocuteur.avatar_url}
              alt={interlocuteur.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white text-sm font-bold">{interlocuteurInitial}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {interlocuteur?.full_name ?? "Interlocuteur"}
          </p>
          <p className="text-xs text-gray-500 truncate">{missionTitle}</p>
        </div>
      </header>

      {/* Barre "Confirmer et payer" — client uniquement si mission en cours */}
      {missionStatus === "in_progress" && userRole === "client" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-800">
            La mission est en cours. Confirmez la fin pour procéder au paiement.
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

      {/* Zone de messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 text-center px-8">
              Aucun message pour l&apos;instant. Démarrez la conversation !
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
            />
          ))
        )}
        {/* Ancre de scroll */}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <div className="border-t border-gray-100 bg-white px-3 py-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="Écrivez un message… (Entrée pour envoyer)"
          rows={1}
          disabled={isSending}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent disabled:opacity-60 overflow-hidden leading-relaxed"
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
