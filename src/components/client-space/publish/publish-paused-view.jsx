import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { PublishNotifyForm } from "@/components/vitrine/publish/publish-notify-form"
import { ResumePublishBanner } from "@/components/client-space/wallet/resume-publish-banner"
import { clientMissionsHref } from "@/lib/app/client-routes"
import { PAYMENTS_PENDING_COPY } from "@/lib/constants/payments"

const COPY = PAYMENTS_PENDING_COPY.publish

/**
 * « Publication en cours d'activation » : remplace la publication tant que les paiements sont coupés
 * (le drapeau est lu côté serveur par la page, qui choisit cette vue). Aucune publication n'est possible ici :
 * `createMission` refuse aussi côté serveur. Le lien de reprise (`resumeHref`, déjà validé par la page)
 * est mémorisé pour le jour de la réouverture.
 * @param {{ resumeHref?: string }} props
 */
export function PublishPausedView({ resumeHref }) {
  return (
    <div className="page2">
      {resumeHref ? <ResumePublishBanner mode="store" href={resumeHref} /> : null}
      <PageHead date="Publier une mission" title={COPY.title} />
      <div className="split2">
        <section className="card2 form2" aria-label="Prévenez-moi">
          <p className="note2">
            <Icon name="i-clock" />
            <span>{COPY.lead}</span>
          </p>
          <div className="sec2">
            <h2 className="sec2__title">Prévenez-moi</h2>
          </div>
          <p className="note2">
            <span>Laissez votre adresse email : nous vous écrivons dès que vous pouvez publier votre première mission.</span>
          </p>
          <PublishNotifyForm variant="ds" idPrefix="publish-notify" />
        </section>
        <div className="col2">
          <section className="card2" aria-label="Séquestre">
            <div className="sec2">
              <h2 className="sec2__title">Votre argent reste protégé</h2>
            </div>
            <p className="note2 note2--box">
              <Icon name="i-lock" />
              <span>
                À l&apos;ouverture, le budget est bloqué en séquestre jusqu&apos;à ce que vous validiez le travail de
                l&apos;étudiant. Si la mission est annulée, vous êtes intégralement remboursé.
              </span>
            </p>
            <div className="actions2">
              <Link className="btn btn--soft" href={clientMissionsHref()}>
                Voir mes missions
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
