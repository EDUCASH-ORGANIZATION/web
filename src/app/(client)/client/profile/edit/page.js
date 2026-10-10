import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { getMyProfile } from "@/lib/actions/profile.actions"
import { ClientEditForm } from "@/components/profile/client-edit-form"

export const metadata = { title: "Modifier mon profil — EduCash" }

export default async function ClientProfileEditPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const { profile, error } = await getMyProfile()
  // Sans lecture fiable du profil, le formulaire enverrait un téléphone vide et l'effacerait.
  if (error) throw new Error(error)

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto flex flex-col gap-6">

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link
          href="/client/profile"
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-gray-900">Modifier mon profil</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mettez à jour vos informations personnelles</p>
        </div>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <ClientEditForm profile={profile} />
      </div>
    </div>
  )
}
