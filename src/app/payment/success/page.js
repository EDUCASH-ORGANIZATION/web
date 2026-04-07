import Link from "next/link"
import { redirect } from "next/navigation"
import { CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"

export const metadata = { title: "Paiement effectué — EduCash" }

export default async function PaymentSuccessPage({ searchParams }) {
  const { missionId } = searchParams
  if (!missionId) redirect("/client/dashboard")

  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("mission_id", missionId)
    .eq("status", "paid")
    .single()

  const fmt = (n) =>
    n != null ? new Intl.NumberFormat("fr-FR").format(n) : "—"

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center text-center">

        {/* Icône succès */}
        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mb-5 shadow-lg">
          <CheckCircle size={40} className="text-white" strokeWidth={2} />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Paiement effectué ✓
        </h1>
        <p className="text-gray-500 text-sm">
          La mission est maintenant terminée.
        </p>

        {/* Card récapitulatif */}
        {transaction && (
          <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6 flex flex-col gap-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Montant payé</span>
              <span className="text-sm font-medium text-gray-900">
                {fmt(transaction.amount_total)} FCFA
              </span>
            </div>
            <div className="border-t border-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Versé à l&apos;étudiant</span>
              <span className="text-sm font-semibold text-emerald-700">
                {fmt(transaction.amount_student)} FCFA
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex flex-col gap-3 mt-6">
          <Link
            href={`/review/${missionId}`}
            className="w-full h-11 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center touch-manipulation"
          >
            Laisser un avis
          </Link>

          <Link
            href="/client/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Retour au tableau de bord
          </Link>
        </div>

      </div>
    </div>
  )
}
