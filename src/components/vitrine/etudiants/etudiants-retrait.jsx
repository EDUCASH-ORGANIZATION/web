import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"
import { formatFcfa } from "@/lib/vitrine/format"
import { Payers } from "../shared/payers"

// Retrait et vérification (maquette V05 v3). Aucun délai de virement, aucun délai d'examen de carte,
// aucun recrédit automatique : en cas de souci, la médiation passe par la page Contact.
export function EtudiantsRetrait() {
  return (
    <section className="section" id="retrait">
      <div className="section__head">
        <div>
          <span className="eyebrow eyebrow--bleu">Retrait et vérification</span>
          <h2 className="display display--l ds-mt-3">
            Ton argent sur ton MoMo.<br /><span className="hl-bleu">Ton sérieux, vérifié.</span>
          </h2>
        </div>
      </div>
      <div className="v-etu-duo">
        <div className="card card--hl stack stack--3">
          <div className="row">
            <span className="ic-sq ic-sq--bleu"><Icon name="i-smartphone" /></span>
            <h3 className="ds-h3">Retire sur ton Mobile Money</h3>
          </div>
          <p className="body-s muted">
            Dès {formatFcfa(MIN_WITHDRAWAL_AMOUNT)}, sur ton numéro béninois.
          </p>
          <Payers />
          <div className="banner banner--info">
            <div className="banner__body">
              Un souci avec un retrait&nbsp;? Contacte l&rsquo;équipe EduCash depuis la page{" "}
              <Link className="link" href="/contact?sujet=signalement">Contact</Link>.
            </div>
          </div>
        </div>
        <div className="card card--hl stack stack--3">
          <div className="row">
            <span className="ic-sq"><Icon name="i-shield" /></span>
            <h3 className="ds-h3">Fais-toi vérifier</h3>
          </div>
          <p className="body-s muted">
            Ta carte étudiante n&rsquo;est demandée qu&rsquo;au moment de postuler. L&rsquo;équipe la contrôle à la main.
          </p>
          <div className="stack stack--2">
            <div className="row row--between">
              <span className="body-s">1. Carte envoyée</span>
              <span className="badge badge--alerte badge--sm">À contrôler</span>
            </div>
            <div className="row row--between">
              <span className="body-s">2. Carte contrôlée</span>
              <span className="verified verified--sm">Vérifié</span>
            </div>
            <div className="row row--between">
              <span className="body-s">3. Badge valable 1 an</span>
              <span className="tag tag--neutre">Renouvelable</span>
            </div>
          </div>
          <div className="banner banner--citron">
            <div className="banner__body">Le badge rassure les familles&nbsp;: c&rsquo;est souvent lui qui fait la différence.</div>
          </div>
        </div>
      </div>
    </section>
  )
}
