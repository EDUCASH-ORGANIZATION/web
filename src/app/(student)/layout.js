import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/shared/sidebar"
import { StudentHeader } from "@/components/shared/student-header"
import { BottomNav } from "@/components/shared/bottom-nav"

export default async function StudentLayout({ children }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const role = user.user_metadata?.role ?? "student"
  if (role !== "student") redirect("/client/dashboard")

  const [{ data: profile }, { data: studentProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, role, city")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("student_profiles")
      .select("school")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  return (
    <div className="flex h-full min-h-screen bg-[#F5F6FA]">
      <Sidebar role="student" profile={profile} />
      <div className="flex-1 min-w-0 flex flex-col">
        <StudentHeader
          profile={profile}
          school={studentProfile?.school}
          userId={user.id}
        />
        <main className="flex-1 pb-20 lg:pb-0 overflow-auto">
          {children}
        </main>
      </div>
      <BottomNav role="student" />
    </div>
  )
}
