import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { ConversationView } from "@/components/messages/conversation-view"

export const metadata = { title: "Conversation — EduCash" }

export default async function ClientConversationPage({ params }) {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()
  const { missionId } = params

  const [{ data: messages }, { data: mission }] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("mission_id", missionId)
      .order("created_at", { ascending: true }),

    supabase
      .from("missions")
      .select("title, status, selected_student_id, client_id")
      .eq("id", missionId)
      .eq("client_id", user.id) // garde : seul le propriétaire
      .single(),
  ])

  if (!mission) notFound()

  // L'interlocuteur du client = l'étudiant sélectionné (ou null si pas encore choisi)
  let interlocuteur = null
  if (mission.selected_student_id) {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .eq("user_id", mission.selected_student_id)
      .single()
    interlocuteur = data
  }

  // Fallback : trouve l'interlocuteur depuis les messages existants
  if (!interlocuteur && messages?.length) {
    const otherId = messages[0].sender_id === user.id
      ? messages[0].receiver_id
      : messages[0].sender_id
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .eq("user_id", otherId)
      .single()
    interlocuteur = data
  }

  return (
    <ConversationView
      initialMessages={messages ?? []}
      missionId={missionId}
      currentUserId={user.id}
      interlocuteur={interlocuteur ?? { user_id: "", full_name: "Étudiant", avatar_url: null }}
      missionTitle={mission.title}
      missionStatus={mission.status}
      userRole="client"
    />
  )
}
