import { createClient } from "@/lib/supabase/server"
import { VitrineProvider } from "@/components/vitrine/vitrine-provider"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"
import { Hero } from "@/components/vitrine/hero"
import { HowItWorks } from "@/components/vitrine/how-it-works"
import { StatsBand, TrustBadges, MissionTypes, Testimonials, FinalCTA } from "@/components/vitrine/sections"

export const metadata = {
  title: "EduCash — Missions rémunérées pour étudiants au Bénin",
  description: "Marketplace de missions ponctuelles entre étudiants et clients à Cotonou, Porto-Novo et Abomey-Calavi. Paiement sécurisé via FedaPay.",
}

export default async function HomePage() {
  const supabase = await createClient()

  const [{ count: studentsCount }, { count: missionsCount }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("missions").select("*", { count: "exact", head: true }),
  ])

  const students = studentsCount ?? 0
  const missions = missionsCount ?? 0

  return (
    <VitrineProvider>
      <VitrineNavbar />
      <Hero students={students} />
      <StatsBand students={students} missions={missions} />
      <TrustBadges />
      <MissionTypes />
      <HowItWorks />
      <Testimonials />
      <FinalCTA />
      <VitrineFooter />
    </VitrineProvider>
  )
}
