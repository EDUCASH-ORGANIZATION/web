import Image from "next/image"
import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { PayButton } from "@/components/payment/pay-button"
import { ShieldCheck } from "lucide-react"

export const metadata = { title: "Confirmer le paiement — EduCash" }

function Avatar({ name, avatarUrl }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? "?"
  return (
    <div className="relative w-10 h-10 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} fill className="object-cover" />
      ) : (
        <span className="text-white text-sm font-bold">{initial}</span>
      )}
    </div>
  )
}

function Divider() {
  return <div className="border-t border-gray-100" />
}

export default async function PaymentPage({ params }) {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()
  const { missionId } = params

  // Charge la mission (doit appartenir au client connecté)
  const { data: mission } = await supabase
    .from("missions")
    .select("id, title, budget, status, selected_student_id")
    .eq("id", missionId)
    .eq("client_id", user.id)
    .single()

  if (!mission) notFound()
  if (mission.status !== "in_progress") redirect(`/client/missions/${missionId}`)

  // Charge le profil de l'étudiant retenu
  let studentProfile = null
  if (mission.selected_student_id) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", mission.selected_student_id)
      .single()
    studentProfile = data
  }

  const budget = mission.budget
  const commission = Math.round(budget * 0.12)
  const netAmount = budget - commission

  const fmt = (n) => new Intl.NumberFormat("fr-FR").format(n)
  const studentFirstName = studentProfile?.full_name?.split(" ")?.[0] ?? "l'étudiant"

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Titre */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Confirmer le paiement</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vérifiez les détails avant de procéder.
          </p>
        </div>

        {/* Card récapitulatif */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Mission title */}
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Mission</p>
            <p className="text-base font-semibold text-gray-900 leading-snug">{mission.title}</p>
          </div>

          <Divider />

          {/* Étudiant retenu */}
          <div className="px-6 py-4 flex items-center gap-3">
            <Avatar
              name={studentProfile?.full_name ?? "Étudiant"}
              avatarUrl={studentProfile?.avatar_url}
            />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Étudiant retenu</p>
              <p className="text-sm font-semibold text-gray-900">
                {studentProfile?.full_name ?? "Étudiant"}
              </p>
            </div>
          </div>

          <Divider />

          {/* Détail financier */}
          <div className="px-6 py-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Montant total</span>
              <span className="text-sm font-medium text-gray-900">{fmt(budget)} FCFA</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Commission EduCash (12%)</span>
              <span className="text-sm text-gray-500">− {fmt(commission)} FCFA</span>
            </div>
          </div>

          <Divider />

          <div className="px-6 py-5 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Versé à {studentFirstName}
            </span>
            <span className="text-lg font-bold text-green-700">{fmt(netAmount)} FCFA</span>
          </div>
        </div>

        {/* Bouton payer */}
        <div className="mt-6">
          <PayButton missionId={missionId} />
        </div>

        {/* Note sécurité */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <ShieldCheck size={13} />
          <span>Paiement sécurisé via FedaPay · Mobile Money accepté</span>
        </div>

      </div>
    </div>
  )
}
