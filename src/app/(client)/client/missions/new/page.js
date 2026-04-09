import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { NewMissionForm } from "@/components/client/new-mission-form"

export const metadata = { title: "Nouvelle mission — EduCash" }

export default async function NewMissionPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, city")
    .eq("user_id", user.id)
    .single()

  return (
    <div className="p-6 lg:p-8 min-h-screen">
      <NewMissionForm profile={profile} />
    </div>
  )
}
