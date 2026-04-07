import { redirect } from "next/navigation"
import { MessageSquare } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { ConversationItem } from "@/components/messages/conversation-item"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata = { title: "Messages — EduCash" }

export default async function StudentMessagesPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const { data: rawMessages } = await supabase
    .from("messages")
    .select("*, missions(title, status), profiles!sender_id(full_name, avatar_url)")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false })

  // Déduplique par mission_id — garde le message le plus récent par conversation
  const seen = new Set()
  const conversations = []

  for (const msg of rawMessages ?? []) {
    if (seen.has(msg.mission_id)) continue
    seen.add(msg.mission_id)

    // Compte les non lus : reçus par cet utilisateur et non encore lus
    const unreadCount = (rawMessages ?? []).filter(
      (m) => m.mission_id === msg.mission_id && m.read === false && m.receiver_id === user.id
    ).length

    conversations.push({
      missionId:     msg.mission_id,
      missionTitle:  msg.missions?.title ?? "Mission",
      lastMessage:   msg.content,
      lastMessageAt: msg.created_at,
      unreadCount,
      // L'autre participant est l'expéditeur si ce n'est pas nous, sinon le destinataire
      senderName:   msg.sender_id !== user.id
        ? (msg.profiles?.full_name ?? "")
        : "",
      senderAvatar: msg.sender_id !== user.id
        ? (msg.profiles?.avatar_url ?? null)
        : null,
    })
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        {conversations.length > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            {conversations.length} conversation{conversations.length > 1 ? "s" : ""}
          </p>
        )}
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Aucune conversation"
          message="Tes échanges avec les clients apparaîtront ici une fois qu'une mission sera en cours."
          ctaLabel="Explorer les missions"
          ctaHref="/missions"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.missionId}
              conversation={conv}
              role="student"
            />
          ))}
        </div>
      )}
    </div>
  )
}
