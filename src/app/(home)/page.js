import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { Faq } from "@/components/vitrine/shared/faq"
import { HashScroll } from "@/components/vitrine/shared/hash-scroll"
import { Scribble } from "@/components/vitrine/shared/scribble"
import { Icon } from "@/components/design/icon"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { HomeHero } from "@/components/vitrine/home/home-hero"
import { HomeProofs } from "@/components/vitrine/home/home-proofs"
import { HomeCatalog } from "@/components/vitrine/home/home-catalog"
import { HomeAchats } from "@/components/vitrine/home/home-achats"
import { HomeSteps } from "@/components/vitrine/home/home-steps"
import { HomeTrust } from "@/components/vitrine/home/home-trust"
import { FAQ_ITEMS, MIN_BUDGET } from "@/components/vitrine/home/home-content"
import { PUBLISH_PATH } from "@/lib/utils/publish-prefill"

export const metadata = {
  title: { absolute: "EduCash - Des étudiants vérifiés pour vos petites missions au Bénin" },
  description:
    "Le marché, les devoirs des enfants, une démarche à faire : confiez vos petites missions à des étudiants vérifiés à Cotonou, Porto-Novo et Abomey-Calavi. Votre argent reste bloqué jusqu'à votre validation.",
  openGraph: {
    title: "EduCash - Des étudiants vérifiés pour vos petites missions au Bénin",
    description:
      "Votre temps est précieux. Déléguez vos petites missions à des étudiants vérifiés : le paiement est bloqué sur EduCash jusqu'à ce que vous validiez le travail.",
    url: "/",
  },
}

const FAQ_ENTRIES = FAQ_ITEMS.map(({ id, question, answer, warning }) => ({
  id,
  question,
  answer: warning ? <>{answer} <b>{warning}</b></> : answer,
}))

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
  const role = await viewerRole(supabase)
  const publishLink = role === "client" ? PUBLISH_PATH : "/auth/register?role=client"

  return (
    <VitrinePage
      audience="clients"
      navbar={<VitrineNavbar tone="bleu" audience="clients" />}
      before={<HomeHero role={role} />}
    >
      <HashScroll />
      <HomeProofs />
      <HomeCatalog />
      <HomeAchats />
      <HomeSteps />
      <HomeTrust />

      <section className="section">
        <div className="v01-split">
          <div>
            <span className="eyebrow eyebrow--bleu">Questions fréquentes</span>
            <h2 className="display display--l ds-mt-3">
              Vous vous<br /><span className="hl-bleu">demandez&nbsp;?</span>
            </h2>
            <p className="muted ds-mt-4">Les questions des familles et des entreprises. Le reste est dans l&rsquo;aide.</p>
            <Link className="btn btn--secondary ds-mt-6" href="/aide">
              Toute l&rsquo;aide
              <Icon name="i-arrow-right" />
            </Link>
          </div>
          <Faq items={FAQ_ENTRIES} headingLevel={3} />
        </div>
      </section>

      <div className="v-cta2">
        <div className="v-cta v-cta--bleu v05-cta grid-bg on-bleu">
          <span className="badge ds-badge-blanc ds-self-start">Familles et entreprises</span>
          <h2 className="display display--l v-cta__title--low">
            Publiez votre<br /><span className="hl-citron">première mission.</span>
          </h2>
          <p className="body-l ds-measure-m">
            Rédigez librement, le solde n&rsquo;est vérifié qu&rsquo;au moment de publier. Il manque de l&rsquo;argent&nbsp;?
            Vous rechargez sur place, le brouillon est gardé.
          </p>
          <div className="v-cta__actions">
            <Link className="btn btn--accent btn--lg" href={publishLink}>
              Publier une mission
              <span className="btn__dot"><Icon name="i-arrow-right" /></span>
            </Link>
          </div>
          <div className="v-cta__badge">
            <div><b>{MIN_BUDGET.toLocaleString("fr-FR")}</b><span>FCFA de budget minimum</span></div>
          </div>
        </div>
        <div className="v-cta v-cta--citron">
          <span className="badge badge--encre ds-self-start">
            <Icon name="i-graduation" />
            Étudiants
          </span>
          <h2 className="display display--l v-cta__title--low">
            Vous êtes étudiant&nbsp;?<br />Entre deux cours,<br />encaissez.
          </h2>
          <p className="body-l ds-measure-m">
            Des missions payées près de votre fac, retirées sur votre Mobile Money. Tout est expliqué sur la page
            étudiants.
          </p>
          <div className="v-cta__actions">
            <Link className="btn btn--dark btn--lg" href="/etudiants">
              Découvrir la page étudiants
              <span className="btn__dot"><Icon name="i-arrow-right" /></span>
            </Link>
          </div>
          <Scribble name="sc-arrow" className="scribble--encre v-cta__scribble" viewBox="0 0 80 70" />
        </div>
      </div>
    </VitrinePage>
  )
}
