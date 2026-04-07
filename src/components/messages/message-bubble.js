"use client"

const TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * @param {{
 *   message: { content: string, sender_id: string, created_at: string },
 *   currentUserId: string
 * }} props
 */
export function MessageBubble({ message, currentUserId }) {
  const isOwn = message.sender_id === currentUserId

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className="flex flex-col gap-1 max-w-[75%]">
        <div
          className={
            isOwn
              ? "bg-[#E8F5EE] text-gray-900 px-4 py-2.5 text-sm leading-relaxed"
              + " rounded-[16px_16px_4px_16px]"
              : "bg-gray-100 text-gray-900 px-4 py-2.5 text-sm leading-relaxed"
              + " rounded-[16px_16px_16px_4px]"
          }
        >
          {message.content}
        </div>
        <span className={`text-[11px] text-gray-400 ${isOwn ? "text-right" : "text-left"} px-1`}>
          {TIME_FORMAT.format(new Date(message.created_at))}
        </span>
      </div>
    </div>
  )
}
