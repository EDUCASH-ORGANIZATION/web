// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { MissionHeader } from "./mission-header"
import { Track, trackSteps } from "./followup/track"
import { EarningLines } from "./followup/earning-lines"
import { Receipt } from "./followup/receipt"
import { PurchasesBlock } from "./followup/purchases-block"
import { DeclareEnd } from "./followup/declare-end"
import { clientWho, declaredFunds } from "./followup/declare-copy"
import { safeDateFr } from "@/lib/app/format"
import { COMPLETION_COPY } from "@/lib/missions/completion"
import { ratingText } from "./apply/client-card"
import { clientFirstName, missionDetailView } from "@/lib/student-space/mission-view"
import { studentApplicationsHref, studentConversationHref, studentReviewHref } from "@/lib/app/student-routes"

const REPORT_HREF = "/contact?sujet=question"
const MOBILE_TITLES = { in_progress: "Mission en cours", done: "Mission terminée", cancelled: "Mission annulée" }

/**
 * E05 Mission retenue, suivi (données réelles seulement). Composant pur : tout vient de `detail`, déjà filtré
 * par `getStudentMissionDetail` (état "selected", grand livre de l'étudiant seul).
 *
 * `detail` : { state: "selected", mission, client (public), application (createdAt, acceptedAt), isSelected,
 * ledger: [{ type: "release", amount (NET), createdAt }], review: { id, rating, comment, createdAt } | null }.
 * Les calculs viennent de `missionDetailView(detail)` : statut, escrowSplit, actions, chronologie, reçu.
 * Fin de mission (`detail.completion`, colonne disponible) : « J'ai terminé » (carte + barre mobile + modale, îlot
 * client `DeclareEnd`) tant que la fin n'est pas déclarée, puis l'état « À confirmer » daté, sans bouton. Colonne
 * indisponible : le texte d'origine, aucun état. Aucune séance.
 *
 * Mission avec achats : `detail.purchases` (lecteur de RD-ACHATS-01) nourrit le bloc « Demandes de paiement d'achats »
 * (liste, totaux hors séquestre, bouton « Demander un paiement d'achats » si `canCreate`) ; indisponible, le bloc
 * d'estimation d'origine s'affiche sans bouton. Les achats n'entrent jamais dans le séquestre ni dans le net.
 *
 * `flags` = { postuler, terminer, paymentsEnabled } : `paymentsEnabled` décide si le badge et la phrase « séquestre »
 * s'affichent (paiements coupés : texte neutre, aucune promesse de fonds bloqués) ; `terminer` (`?terminer=1`) ouvre la
 * modale « J'ai terminé » seulement si `actions.declareEnd`, sans rien écrire.
 *
 * @param {{ detail: import("@/lib/actions/student-mission-detail.actions").StudentMissionDetailOpen,
 *   flags: { postuler: boolean, terminer?: boolean, paymentsEnabled: boolean } }} props
 */
export function MissionFollowupView({ detail, flags }) {
  const view = missionDetailView(detail)
  const { mission, client } = detail
  const { actions, receipt, completion } = view
  const split = view.gainValid ? view.split : null
  const paymentsOn = flags?.paymentsEnabled === true
  const clientFirst = clientFirstName(client.name)
  const declared = completion.state === "declared"
  const declaredDate = safeDateFr(completion.declaredAt)
  const sub = [client.city, ratingText(client.rating)].filter(Boolean).join(" · ")
  const awaiting = declared
    ? `Quand ${clientWho(client.name).lower} confirme la fin de la mission${paymentsOn ? " ; votre part reste en séquestre d'ici là" : ""}`
    : null
  const steps = trackSteps(view.timeline, { status: mission.status, hasLedger: receipt.hasLedger, awaiting })

  return (
    <>
      <header className="e2-mtop">
        <Link className="iconbtn2" href={studentApplicationsHref()} aria-label="Retour aux candidatures">
          <Icon name="i-arrow-left" />
        </Link>
        <span className="e2-mtop__title">{MOBILE_TITLES[mission.status] ?? "Mission"}</span>
        {actions.writeToClient ? (
          <Link className="iconbtn2" href={studentConversationHref(mission.id)} aria-label="Écrire au client">
            <Icon name="i-message" />
          </Link>
        ) : (
          <span className="e2-mtop__spacer" />
        )}
      </header>
      <MissionHeader
        mission={mission}
        withPurchasesLine={false}
        back={{ href: studentApplicationsHref(), label: "Candidatures" }}
        variant="05"
        retainedAt={detail.application?.acceptedAt ?? null}
      />
      <div className="e2-cols">
        <div className="e2-stack">
          {view.purchases ? (
            <PurchasesBlock
              purchases={view.purchases}
              clientName={client.name}
              cancelled={mission.status === "cancelled"}
              missionId={mission.id}
              missionStatus={mission.status}
              listing={detail.purchases}
            />
          ) : null}
          <section className="e2-sec" aria-label="Où en est la mission">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Où en est la mission</h2>
              {mission.status === "in_progress" ? (
                <StatusBadge label={declared ? COMPLETION_COPY.toConfirmBadge : "En cours"} />
              ) : null}
            </div>
            <div className="e2-sec__body">
              <Track steps={steps} />
            </div>
          </section>
        </div>
        <aside className="e2-stack e2-05-aside">
          {mission.status === "done" ? (
            <Receipt split={split} receipt={receipt} />
          ) : (
            <EarningLines
              split={split}
              cancelled={mission.status === "cancelled"}
              paymentsEnabled={paymentsOn}
              withPurchases={Boolean(view.purchases)}
              clientName={client.name}
            />
          )}
          {mission.status === "in_progress" ? (
            actions.declareEnd ? (
              <DeclareEnd
                missionId={mission.id}
                title={mission.title}
                clientName={client.name}
                net={split ? split.student : null}
                paymentsEnabled={paymentsOn}
                reportHref={REPORT_HREF}
                initialOpen={flags?.terminer === true}
              />
            ) : (
              <section className="e2-sec" aria-label="Fin de mission">
                <div className="e2-sec__head">
                  <h2 className="e2-sec__title">{declared ? "Fin de mission" : "Vous avez fini ?"}</h2>
                  {declared ? <StatusBadge label={COMPLETION_COPY.toConfirmBadge} icon="i-clock" /> : null}
                </div>
                <div className="e2-sec__body">
                  {declared ? (
                    <>
                      <p className="e2-05-caption">
                        {declaredDate ? `Vous avez indiqué avoir terminé le ${declaredDate}.` : "Vous avez indiqué avoir terminé."}{" "}
                        {`${clientWho(client.name).upper} doit maintenant confirmer la fin. ${declaredFunds(paymentsOn)}`}
                      </p>
                      <p className="e2-05-caption">
                        Un désaccord ?{" "}
                        <Link className="e2-link e2-link--quiet" href={REPORT_HREF}>
                          Contactez l&apos;équipe EduCash
                        </Link>
                      </p>
                    </>
                  ) : (
                    <p className="e2-05-caption">
                      Quand c&apos;est fini, prévenez le client dans la messagerie : il confirme la fin et votre part est
                      versée sur votre portefeuille.
                    </p>
                  )}
                  {!declared && actions.reportProblem ? (
                    <Link className="e2-link e2-link--quiet" href={REPORT_HREF}>
                      <Icon name="i-flag" />
                      Signaler un problème
                    </Link>
                  ) : null}
                </div>
              </section>
            )
          ) : null}
          <section className="e2-sec" aria-label="Le client">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Le client</h2>
            </div>
            <div className="e2-sec__body">
              <div className="e2-who">
                <Avatar name={client.name} src={client.avatarUrl} verified={client.isVerified} />
                <div className="e2-05-min">
                  <div className="e2-who__name">{client.name}</div>
                  {sub ? <div className="e2-who__sub">{sub}</div> : null}
                </div>
              </div>
              <div className="e2-05-actions">
                {actions.writeToClient ? (
                  <Link className="e2-link" href={studentConversationHref(mission.id)}>
                    <Icon name="i-message" />
                    {clientFirst ? `Écrire à ${clientFirst}` : "Écrire au client"}
                  </Link>
                ) : null}
                {actions.rate ? (
                  <Link className="e2-link" href={studentReviewHref(mission.id)}>
                    <Icon name="i-star" />
                    Noter le client
                  </Link>
                ) : null}
                {actions.viewReview ? <span className="e2-muted">Avis donné</span> : null}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}

export default MissionFollowupView
