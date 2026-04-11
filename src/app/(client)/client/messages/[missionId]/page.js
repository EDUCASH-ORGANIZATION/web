import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { ConversationView } from "@/components/messages/conversation-view"

export const metadata = { title: "Conversation — EduCash" }

export default async function ClientConversationPage({ params, searchParams }) {
  const { missionId } = await params
  const { studentId: studentIdParam } = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

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

  // Ordre de priorité pour trouver l'interlocuteur :
  // 1. Étudiant sélectionné sur la mission
  // 2. studentId passé en query param (candidature pending)
  // 3. Depuis les messages existants
  let interlocuteur = null
  const targetStudentId = mission.selected_student_id ?? studentIdParam ?? null

  if (targetStudentId) {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, is_verified, verified_until")
      .eq("user_id", targetStudentId)
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
      .select("user_id, full_name, avatar_url, is_verified, verified_until")
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
