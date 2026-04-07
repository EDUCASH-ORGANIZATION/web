import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { ConversationView } from "@/components/messages/conversation-view"

export const metadata = { title: "Conversation — EduCash" }

export default async function StudentConversationPage({ params }) {
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
      .select("title, status, client_id")
      .eq("id", missionId)
      .single(),
  ])

  if (!mission) notFound()

  // L'interlocuteur de l'étudiant = le client de la mission
  const { data: interlocuteur } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url")
    .eq("user_id", mission.client_id)
    .single()

  return (
    <ConversationView
      initialMessages={messages ?? []}
      missionId={missionId}
      currentUserId={user.id}
      interlocuteur={interlocuteur ?? { user_id: mission.client_id, full_name: "Client", avatar_url: null }}
      missionTitle={mission.title}
      missionStatus={mission.status}
      userRole="student"
    />
  )
}
