import { COMMISSION_RATE } from "@/lib/constants/missions"
import { createClient } from "@/lib/supabase/server"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { ClientsHero } from "@/components/vitrine/clients/clients-hero"
import {
  EscrowSteps,
  Commission,
  MissionTypes,
  Guarantees,
  ClientFaq,
  ClientsCta,
} from "@/components/vitrine/clients/clients-sections"

const COMMISSION = Math.round(COMMISSION_RATE * 100)

export const metadata = {
  title: "Pour les clients",
  description: `Publiez une petite mission et choisissez un étudiant vérifié au Bénin. Votre budget reste bloqué jusqu'à ce que vous validiez le travail, avec une commission unique de ${COMMISSION} %.`,
  openGraph: { url: "/clients" },
}

// Rôle lu côté serveur pour l'affichage seulement (aucune autorisation ne repose dessus).
async function readRole() {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) return null
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle()
  if (error) {
    console.error("[clients] lecture du rôle impossible", { code: error.code, message: error.message })
    return null
  }
  return data?.role ?? null
}

export default async function ClientsPage() {
  const role = await readRole()
  const publishHref = role === "client" ? "/client/missions/new" : "/auth/register?role=client"

  return (
    <VitrinePage>
      <ClientsHero publishHref={publishHref} />
      <EscrowSteps />
      <Commission />
      <MissionTypes publishHref={publishHref} />
      <Guarantees />
      <ClientFaq />
      <ClientsCta publishHref={publishHref} />
    </VitrinePage>
  )
}
