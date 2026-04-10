import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/shared/sidebar"
import { ClientHeader } from "@/components/shared/client-header"
import { BottomNav } from "@/components/shared/bottom-nav"

export default async function ClientLayout({ children }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const role = user.user_metadata?.role ?? "student"
  if (role !== "client") redirect("/dashboard")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, bio")
    .eq("user_id", user.id)
    .single()

  return (
    <div className="flex h-full min-h-screen bg-[#F5F6FA]">
      <Sidebar role="client" profile={profile} />
      <div className="flex-1 min-w-0 flex flex-col">
        <ClientHeader profile={profile} />
        <main className="flex-1 pb-20 lg:pb-0 overflow-auto">
          {children}
        </main>
      </div>
      <BottomNav role="client" />
    </div>
  )
}
