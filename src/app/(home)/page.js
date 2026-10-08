import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { Faq } from "@/components/vitrine/shared/faq"
import { CtaDouble } from "@/components/vitrine/shared/cta-double"
import { Icon } from "@/components/design/icon"
import { HomeHero } from "@/components/vitrine/home/home-hero"
import { HomeProofs } from "@/components/vitrine/home/home-proofs"
import { HomePreview } from "@/components/vitrine/home/home-preview"
import { HomeSteps } from "@/components/vitrine/home/home-steps"
import { HomeCatalog } from "@/components/vitrine/home/home-catalog"
import { HomeFigures } from "@/components/vitrine/home/home-figures"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"
import { todayInBenin } from "@/lib/vitrine/dates"
import { homeFigures } from "@/lib/vitrine/figures"
import { formatFcfa } from "@/lib/vitrine/format"

export const metadata = {
  title: { absolute: "EduCash - Missions rémunérées pour étudiants au Bénin" },
  description:
    "Marketplace de missions ponctuelles entre étudiants et clients à Cotonou, Porto-Novo et Abomey-Calavi. Paiement sécurisé via FedaPay.",
  openGraph: {
    title: "EduCash - Missions rémunérées pour étudiants au Bénin",
    description:
      "Des petites missions près de ta fac, payées par séquestre et retirées sur ton MoMo, à Cotonou, Porto-Novo et Abomey-Calavi.",
    url: "/",
  },
}

const COMMISSION = Math.round(COMMISSION_RATE * 100)
const REVIEWS_LIMIT = 1000

const FAQ_ITEMS = [
  {
    id: "paye",
    question: "Est-ce que je suis sûr d'être payé ?",
    answer: (
      <>
        Oui. Le client bloque le budget sur EduCash <b>avant</b> que la mission commence : c&rsquo;est le séquestre.
        Quand tu déclares la mission terminée, il confirme, ou l&rsquo;argent t&rsquo;est versé automatiquement au bout
        de 72 h. En cas de désaccord, l&rsquo;équipe tranche.
      </>
    ),
  },
  {
    id: "commission",
    question: "Combien prend EduCash ?",
    answer: `Une seule commission de ${COMMISSION} %, prélevée sur le paiement de l'étudiant. Tu vois toujours ce que tu touches avant de postuler.`,
  },
  {
    id: "retrait",
    question: "Comment je retire mon argent ?",
    answer: `Depuis ton portefeuille, vers ton MTN MoMo ou ton Moov Money, à partir de ${formatFcfa(MIN_WITHDRAWAL_AMOUNT)}.`,
  },
  {
    id: "carte",
    question: "Faut-il une carte étudiante pour s'inscrire ?",
    answer:
      "Non, l'inscription est gratuite. La carte étudiante n'est demandée qu'au moment de postuler : l'équipe la contrôle à la main.",
  },
]

function ctaProps(role) {
  const student =
    role === "student"
      ? { href: "/student/missions", label: "Voir les missions pour moi" }
      : { href: "/auth/register?role=student", label: "Créer mon compte" }
  const client =
    role === "client"
      ? { href: "/client/missions/new", label: "Publier une mission" }
      : { href: role === "student" ? "/clients" : "/auth/register?role=client", label: role === "student" ? "Pour les clients" : "Publier une mission" }
  return {
    student: {
      title: (
        <>
          Ton temps<br />vaut de l&rsquo;argent.<br />Prouve-le.
        </>
      ),
      text: "Crée ton profil gratuitement, postule près de ta fac et encaisse sur ton MoMo.",
      ...student,
    },
    client: {
      title: (
        <>
          Une mission ?<br /><span className="hl-citron">Un étudiant vérifié.</span>
        </>
      ),
      text: "Publiez votre besoin en deux minutes. Le budget reste bloqué jusqu'à ce que vous validiez le travail.",
      ...client,
    },
  }
}

async function loadHome(supabase) {
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
    if (res.error) console.error(`[home] ${name} failed`, { code: res.error.code, message: res.error.message })
  }

  const ratings = (reviewsRes.data ?? []).map((r) => Number(r.rating)).filter(Number.isFinite)
  const ratingAvg = ratings.length > 0 ? ratings.reduce((sum, n) => sum + n, 0) / ratings.length : 0
  const countersFailed = Boolean(openRes.error || studentsRes.error)

  return {
    figures: homeFigures({
      openMissions: openRes.error ? 0 : openRes.count,
      verifiedStudents: studentsRes.error ? 0 : studentsRes.count,
      reviewsCount: reviewsRes.error ? 0 : ratings.length,
      ratingAvg,
    }),
    countersFailed,
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

export default async function HomePage() {
  const supabase = await createClient()
  const [home, role] = await Promise.all([loadHome(supabase), viewerRole(supabase)])
  const { figures, openCount, missions, previewError } = home
  const live = figures.mode === "live"
  const cta = ctaProps(role)

  return (
    <VitrinePage>
      <HomeHero live={live} openMissions={figures.openMissions} role={role} />
      <HomeProofs rating={figures.rating} />
      <HomePreview missions={missions} openCount={openCount} error={previewError} />
      <HomeSteps />
      <HomeCatalog />
      <HomeFigures figures={figures} />

      <section className="section">
        <div className="v01-split">
          <div>
            <span className="eyebrow eyebrow--bleu">Questions fréquentes</span>
            <h2 className="display display--l ds-mt-3">
              Tu te<br /><span className="hl-bleu">demandes ?</span>
            </h2>
            <p className="muted ds-mt-4">Les 4 questions qu&rsquo;on nous pose le plus. Le reste est dans l&rsquo;aide.</p>
            <Link className="btn btn--secondary ds-mt-6" href="/aide">
              Toutes les questions
              <Icon name="i-arrow-right" />
            </Link>
          </div>
          <Faq items={FAQ_ITEMS} headingLevel={3} />
        </div>
      </section>

      <CtaDouble student={cta.student} client={cta.client} />
    </VitrinePage>
  )
}
