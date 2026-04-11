import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { RealtimeConversationsList } from "@/components/messages/realtime-conversations-list"

export const metadata = { title: "Messages — EduCash" }

export default async function ClientMessagesPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const { data: rawMessages } = await supabase
    .from("messages")
    .select("*, missions(title, status)")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false })

  // Déduplique par mission_id — garde le message le plus récent par conversation
  const seen = new Set()
  const conversations = []
  const otherUserIds = []

  for (const msg of rawMessages ?? []) {
    if (seen.has(msg.mission_id)) continue
    seen.add(msg.mission_id)

    const unreadCount = (rawMessages ?? []).filter(
      (m) => m.mission_id === msg.mission_id && m.read === false && m.receiver_id === user.id
    ).length

    const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
    otherUserIds.push(otherId)

    conversations.push({
      missionId:     msg.mission_id,
      missionTitle:  msg.missions?.title ?? "Mission",
      lastMessage:   msg.content,
      lastMessageAt: msg.created_at,
      unreadCount,
      _otherId:      otherId,
      senderName:    "",
      senderAvatar:  null,
    })
  }

  // Récupère les profils des interlocuteurs en une seule requête
  if (otherUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", otherUserIds)

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]))
    for (const conv of conversations) {
      const p = profileMap[conv._otherId]
      if (p) { conv.senderName = p.full_name ?? ""; conv.senderAvatar = p.avatar_url ?? null }
      delete conv._otherId
    }
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Messages</h1>
        {conversations.length > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            {conversations.length} conversation{conversations.length > 1 ? "s" : ""}
          </p>
        )}
      </div>

      <RealtimeConversationsList
        initialConversations={conversations}
        currentUserId={user.id}
        role="client"
        emptyTitle="Aucune conversation"
        emptyMessage="Vos échanges avec les étudiants apparaîtront ici une fois qu'une candidature sera acceptée."
        emptyCtaLabel="Voir mes missions"
        emptyCtaHref="/client/missions"
      />
    </div>
  )
}
