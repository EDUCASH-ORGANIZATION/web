import { createClient } from "@/lib/supabase/server"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { HashScroll } from "@/components/vitrine/shared/hash-scroll"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { EtudiantsHero } from "@/components/vitrine/etudiants/etudiants-hero"
import { EtudiantsProofs } from "@/components/vitrine/etudiants/etudiants-proofs"
import { EtudiantsPreview } from "@/components/vitrine/etudiants/etudiants-preview"
import { EtudiantsGains } from "@/components/vitrine/etudiants/etudiants-gains"
import { EtudiantsSteps } from "@/components/vitrine/etudiants/etudiants-steps"
import { EtudiantsRetrait } from "@/components/vitrine/etudiants/etudiants-retrait"
import { EtudiantsServices } from "@/components/vitrine/etudiants/etudiants-services"
import { EtudiantsFaq } from "@/components/vitrine/etudiants/etudiants-faq"
import { EtudiantsClosing } from "@/components/vitrine/etudiants/etudiants-closing"
import { studentAction } from "@/components/vitrine/etudiants/etudiants-cta"
import { todayInBenin } from "@/lib/vitrine/dates"
import { homeFigures } from "@/lib/vitrine/figures"

export const metadata = {
  title: "Pour les étudiants",
  description:
    "Bosse entre deux cours et encaisse : des missions près de ta fac à Cotonou, Porto-Novo et Abomey-Calavi, payées par séquestre et retirées sur ton MTN MoMo, ton Moov Money ou ton Celtiis Cash.",
  openGraph: {
    title: "Pour les étudiants - EduCash",
    description:
      "Des petites missions près de ta fac, payées par séquestre et retirées sur ton Mobile Money, à Cotonou, Porto-Novo et Abomey-Calavi.",
    url: "/etudiants",
  },
}

const REVIEWS_LIMIT = 1000

async function loadData(supabase) {
  const today = todayInBenin()
  const notExpired = `deadline.is.null,deadline.gte.${today}`

  const [openRes, studentsRes, reviewsRes, previewRes] = await Promise.all([
    supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .or(notExpired),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .eq("is_verified", true),
    supabase.from("reviews").select("rating").limit(REVIEWS_LIMIT),
    supabase
      .from("missions")
      .select("id, title, type, city, budget, urgency, deadline, created_at")
      .eq("status", "open")
      .or(notExpired)
      .order("created_at", { ascending: false })
      .limit(3),
  ])

  for (const [name, res] of [
    ["open missions", openRes],
    ["verified students", studentsRes],
    ["reviews", reviewsRes],
    ["preview", previewRes],
  ]) {
    if (res.error) console.error(`[etudiants] ${name} failed`, { code: res.error.code, message: res.error.message })
  }

  const ratings = (reviewsRes.data ?? []).map((r) => Number(r.rating)).filter(Number.isFinite)
  const ratingAvg = ratings.length > 0 ? ratings.reduce((sum, n) => sum + n, 0) / ratings.length : 0

  return {
    figures: homeFigures({
      openMissions: openRes.error ? 0 : openRes.count,
      verifiedStudents: studentsRes.error ? 0 : studentsRes.count,
      reviewsCount: reviewsRes.error ? 0 : ratings.length,
      ratingAvg,
    }),
    openCount: openRes.error ? 0 : (openRes.count ?? 0),
    missions: previewRes.data ?? [],
    previewError: Boolean(previewRes.error),
  }
}

// Rôle affiché seulement (adaptation des appels à l'action) : aucune autorisation n'en dépend.
async function viewerRole(supabase) {
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return null
  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
  return profile?.role ?? null
}

export default async function EtudiantsPage() {
  const supabase = await createClient()
  const [data, role] = await Promise.all([loadData(supabase), viewerRole(supabase)])
  const { figures, openCount, missions, previewError } = data
  const live = figures.mode === "live"

  return (
    <VitrinePage
      audience="etudiants"
      navbar={<VitrineNavbar tone="bleu" audience="etudiants" />}
      before={<EtudiantsHero live={live} openMissions={figures.openMissions} role={role} />}
    >
      <HashScroll />
      <EtudiantsProofs rating={figures.rating} />
      <EtudiantsPreview missions={missions} openCount={openCount} error={previewError} cta={studentAction(role)} />
      <EtudiantsGains />
      <EtudiantsSteps />
      <EtudiantsRetrait />
      <EtudiantsServices />
      <EtudiantsFaq />
      <EtudiantsClosing role={role} />
    </VitrinePage>
  )
}
