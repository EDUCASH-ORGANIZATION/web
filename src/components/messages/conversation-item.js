"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import clsx from "clsx"

/**
 * Formate un timestamp selon : aujourd'hui → "14h32", semaine → "lun.", avant → "12 avr."
 * @param {string} dateStr
 * @returns {string}
 */
function formatTimestamp(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isToday) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  }

  const diffDays = Math.floor((now - date) / 86400000)
  if (diffDays < 7) {
    return date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")
  }

  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "")
}

/**
 * Item de liste de conversation.
 *
 * @param {{
 *   conversation: {
 *     missionId: string,
 *     missionTitle: string,
 *     lastMessage: string,
 *     lastMessageAt: string,
 *     unreadCount: number,
 *     senderName: string,
 *     senderAvatar: string | null,
 *   },
 *   role: 'student' | 'client'
 * }} props
 */
export function ConversationItem({ conversation, role }) {
  const router = useRouter()

  const {
    missionId,
    missionTitle,
    lastMessage,
    lastMessageAt,
    unreadCount,
    senderName,
    senderAvatar,
  } = conversation

  const isUnread = unreadCount > 0
  const initial = senderName?.charAt(0)?.toUpperCase() ?? "?"
  const preview = lastMessage?.length > 50
    ? lastMessage.slice(0, 50) + "…"
    : (lastMessage ?? "")

  const href = role === "client"
    ? `/client/messages/${missionId}`
    : `/messages/${missionId}`

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-gray-100 hover:shadow-sm hover:border-gray-200 transition-all text-left touch-manipulation"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="relative w-11 h-11 rounded-full bg-[#1A6B4A] flex items-center justify-center overflow-hidden">
          {senderAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <Image src={senderAvatar} alt={senderName} fill sizes="44px" className="object-cover" />
          ) : (
            <span className="text-white text-base font-bold">{initial}</span>
          )}
        </div>
        {/* Point non lu */}
        {isUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className={clsx(
            "text-sm truncate",
            isUnread ? "font-semibold text-gray-900" : "font-normal text-gray-700"
          )}>
            {missionTitle}
          </p>
          <span className="text-xs text-gray-400 shrink-0">{formatTimestamp(lastMessageAt)}</span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={clsx(
            "text-xs truncate",
            isUnread ? "font-medium text-gray-900" : "text-gray-500"
          )}>
            {preview || "Pas encore de message"}
          </p>

          {unreadCount > 0 && (
            <span className="shrink-0 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
