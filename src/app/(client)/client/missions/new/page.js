import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { getWallet } from "@/lib/actions/wallet.actions"
import { NewMissionForm } from "@/components/client/new-mission-form"
import { WalletRequiredGate } from "@/components/client/wallet-required-gate"
import { MIN_DEPOSIT_AMOUNT } from "@/lib/supabase/database.constants"

export const metadata = { title: "Nouvelle mission — EduCash" }

export default async function NewMissionPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [{ data: profile }, walletResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, city")
      .eq("user_id", user.id)
      .single(),
    getWallet(user.id),
  ])

  // Si wallet introuvable ou solde < minimum → gate
  const available = walletResult.error ? 0 : walletResult.available
  if (available < MIN_DEPOSIT_AMOUNT) {
    return (
      <div className="p-6 lg:p-8 min-h-screen">
        <WalletRequiredGate available={available} />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 min-h-screen">
      <NewMissionForm profile={profile} walletAvailable={available} />
    </div>
  )
}
