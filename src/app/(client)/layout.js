import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/shared/sidebar"
import { BottomNav } from "@/components/shared/bottom-nav"

export default async function ClientLayout({ children }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const role = user.user_metadata?.role ?? "student"
  if (role !== "client") redirect("/dashboard")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role")
    .eq("user_id", user.id)
    .single()

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      <Sidebar role="client" profile={profile} />
      <main className="flex-1 min-w-0 pb-16 lg:pb-0">
        {children}
      </main>
      <BottomNav role="client" />
    </div>
  )
}
