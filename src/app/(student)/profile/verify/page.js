import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { CardUploadForm } from "@/components/profile/card-upload-form"

export const metadata = { title: "Vérification du compte — EduCash" }

export default async function ProfileVerifyPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [{ data: profile }, { data: studentProfile }] = await Promise.all([
    supabase.from("profiles").select("is_verified").eq("user_id", user.id).single(),
    supabase.from("student_profiles").select("card_url").eq("user_id", user.id).single(),
  ])

  // Déjà vérifié → retour au profil
  if (profile?.is_verified) redirect("/profile")

  const hasCard = !!studentProfile?.card_url

  return (
    <div className="p-6 lg:p-8 max-w-xl mx-auto flex flex-col gap-6">

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link
          href="/profile"
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-gray-900">Vérification du compte</h1>
          <p className="text-sm text-gray-500 mt-0.5">Soumettez votre carte étudiante pour débloquer toutes les fonctionnalités</p>
        </div>
      </div>

      {/* Avantages vérification */}
      <div className="bg-[#1A6B4A] rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-4 w-20 h-20 rounded-full bg-white/5" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-white">Débloquez votre badge vérifié</p>
            <p className="text-xs text-white/70 mt-0.5">Augmentez vos chances de sélection de 3×</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 relative z-10">
          {[
            { label: "Postuler aux missions", desc: "Seuls les étudiants vérifiés peuvent postuler" },
            { label: "Badge vérifié", desc: "Visible sur votre profil public" },
            { label: "3× plus de succès", desc: "Statistique confirmée sur EduCash" },
          ].map(({ label, desc }) => (
            <div key={label} className="bg-white/10 rounded-xl p-3 flex flex-col gap-1">
              <p className="text-xs font-bold text-white">{label}</p>
              <p className="text-[10px] text-white/60 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Formulaire upload */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-black text-gray-900 mb-4">
          {hasCard ? "Mettre à jour ma carte étudiante" : "Ajouter ma carte étudiante"}
        </h2>
        <CardUploadForm hasCard={hasCard} />
      </div>
    </div>
  )
}
