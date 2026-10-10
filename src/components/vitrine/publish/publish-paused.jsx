import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PAYMENTS_PENDING_COPY } from "@/lib/constants/payments"
import { PublishNotifyForm } from "./publish-notify-form"

const COPY = PAYMENTS_PENDING_COPY.publish

// Écran public « Publication en cours d'activation » (vitrine, vouvoiement) : remplace la publication
// tant que les paiements sont coupés. Le séquestre est présenté comme le fonctionnement à l'ouverture.
export function PublishPaused() {
  return (
    <>
      <div className="v08-head grid-bg">
        <span className="eyebrow">Publication</span>
        <h1 className="display display--xl ds-mt-6">
          Publication<br />
          <span className="hl-citron">en cours d&rsquo;activation.</span>
        </h1>
        <p className="body-l v08-lead">{COPY.lead}</p>
      </div>

      <section className="section ds-pt-8">
        <div className="ds-container">
          <div className="v08-form">
            <div>
              <h2 className="ds-h2">Prévenez-moi</h2>
              <p className="body-s muted v08-form__lead">
                Laissez votre adresse email : nous vous écrivons dès que vous pouvez publier votre première mission.
              </p>
            </div>
            <PublishNotifyForm variant="ds" idPrefix="publish-notify" />
            <div className="banner banner--info">
              <Icon name="i-lock" />
              <div className="banner__body">
                À l&rsquo;ouverture, le budget est bloqué en séquestre jusqu&rsquo;à ce que vous validiez le travail de
                l&rsquo;étudiant.
              </div>
            </div>
            <div className="row">
              <Link className="btn btn--secondary" href="/missions">Voir les missions</Link>
              <Link className="btn btn--ghost" href="/">Retour à l&rsquo;accueil</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
