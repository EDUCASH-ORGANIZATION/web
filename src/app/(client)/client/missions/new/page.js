import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { NewMissionForm } from "@/components/client/new-mission-form"

export const metadata = { title: "Nouvelle mission — EduCash" }

export default async function NewMissionPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle mission</h1>
          <p className="text-sm text-gray-500 mt-1">
            Décrivez votre besoin pour trouver l&apos;étudiant idéal.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <NewMissionForm />
        </div>
      </div>
    </div>
  )
}
