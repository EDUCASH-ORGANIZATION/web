import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { AideSearch } from "@/components/vitrine/aide/aide-search"
import { AIDE_THEMES, ESCROW_STEPS } from "@/components/vitrine/aide/aide-content"

export const metadata = {
  title: "Aide et FAQ",
  description:
    "Séquestre, paiement, retraits, vérification, missions : les réponses aux questions fréquentes sur EduCash.",
  openGraph: { url: "/aide" },
}

export default function AidePage() {
  return (
    <VitrinePage>
      <AideSearch themes={AIDE_THEMES} />

      <section className="section">
        <div className="ds-container">
          <div className="section__head">
            <div>
              <span className="eyebrow eyebrow--bleu">Le séquestre en clair</span>
              <h2 className="display display--l ds-mt-3">
                Comment ton argent<br />
                <span className="hl-bleu">est protégé.</span>
              </h2>
            </div>
            <p className="muted ds-measure-s ds-text-right">
              Le « Paiement garanti » de l&apos;ancienne page, enfin expliqué.
            </p>
          </div>
          <div className="v07-flow">
            {ESCROW_STEPS.map((step, index) => (
              <div key={step.title} className={`v07-flow__s${step.tone ? ` v07-flow__s--${step.tone}` : ""}`}>
                <span className="num">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <b>{step.title}</b>
                  <p>{step.text}</p>
                </div>
                {index < ESCROW_STEPS.length - 1 ? (
                  <span className="v07-flow__arrow"><Icon name="i-arrow-right" /></span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="banner banner--info v07-litige">
            <Icon name="i-scale" />
            <div className="banner__body">
              <b>Un souci pendant la mission&nbsp;?</b> Contacte l&apos;équipe EduCash depuis la page{" "}
              <Link className="link" href="/contact?sujet=signalement">
                Contact
              </Link>
              &nbsp;: nous intervenons en médiation.
            </div>
          </div>
        </div>
      </section>

      <div className="v07-contact">
        <div>
          <h2 className="display display--l">
            Pas trouvé&nbsp;?<br />
            <span className="hl-citron">Écris-nous.</span>
          </h2>
          <p className="body-s ds-text-brume ds-mt-3 ds-measure-l">
            Une vraie équipe à Cotonou lit chaque message. Pour un problème sur une mission en cours,
            précise-le dans ton message pour qu&apos;on intervienne plus vite.
          </p>
        </div>
        <div className="stack stack--3">
          <Link className="btn btn--accent btn--lg" href="/contact">
            Nous contacter
            <span className="btn__dot"><Icon name="i-arrow-right" /></span>
          </Link>
        </div>
      </div>
    </VitrinePage>
  )
}
