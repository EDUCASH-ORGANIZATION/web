import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { getStudentApplications } from "@/lib/actions/application.actions"
import { ApplicationsTabs } from "@/components/student/applications-tabs"

export const metadata = { title: "Mes candidatures — EduCash" }

export default async function ApplicationsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const applications = await getStudentApplications(user.id)

  const pending  = applications.filter((a) => a.status === "pending")
  const accepted = applications.filter((a) => a.status === "accepted")
  const rejected = applications.filter((a) => a.status === "rejected")

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mes candidatures</h1>
        <p className="text-sm text-gray-500 mt-1">
          {applications.length} candidature{applications.length !== 1 ? "s" : ""} au total
        </p>
      </div>

      <ApplicationsTabs
        pending={pending}
        accepted={accepted}
        rejected={rejected}
      />
    </div>
  )
}
