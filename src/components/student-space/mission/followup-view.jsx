// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { MissionHeader } from "./mission-header"
import { Track, trackSteps } from "./followup/track"
import { EarningLines } from "./followup/earning-lines"
import { Receipt } from "./followup/receipt"
import { missionDetailView } from "@/lib/student-space/mission-view"
import { studentApplicationsHref, studentConversationHref, studentReviewHref } from "@/lib/app/student-routes"

const REPORT_HREF = "/contact?sujet=question"

/**
 * E05 Mission retenue, suivi (données réelles seulement). Composant pur : tout vient de `detail`, déjà filtré
 * par `getStudentMissionDetail` (état "selected", grand livre de l'étudiant seul).
 *
 * `detail` : { state: "selected", mission, client (public), application (createdAt, updatedAt), isSelected,
 * ledger: [{ type: "release", amount (NET), createdAt }], review: { id, rating, comment, createdAt } | null }.
 * Les calculs viennent de `missionDetailView(detail)` : statut, escrowSplit, actions, chronologie, reçu.
 * Aucun bouton « J'ai terminé », aucun état « À confirmer » (aucune donnée en base), aucune séance.
 *
 * `flags` = { postuler, paymentsEnabled } : sans objet ici (la signature est commune aux deux vues).
 *
 * @param {{ detail: import("@/lib/actions/student-mission-detail.actions").StudentMissionDetailOpen,
 *   flags: { postuler: boolean, paymentsEnabled: boolean } }} props
 */
export function MissionFollowupView({ detail }) {
  const view = missionDetailView(detail)
  const { mission, client } = detail
  const { actions, split, receipt } = view
  const steps = trackSteps(view.timeline, { status: mission.status, hasLedger: receipt.hasLedger })

  return (
    <>
      <MissionHeader
        mission={mission}
        status={view.status}
        back={{ href: studentApplicationsHref(), label: "Candidatures" }}
        variant="05"
      />
      <div className="e2-cols">
        <div className="e2-stack">
          <section className="e2-sec" aria-label="Où en est la mission">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Où en est la mission</h2>
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
            <EarningLines split={split} cancelled={mission.status === "cancelled"} />
          )}
          {mission.status === "in_progress" ? (
            <section className="e2-sec" aria-label="Fin de mission">
              <div className="e2-sec__head">
                <h2 className="e2-sec__title">Tu as fini ?</h2>
              </div>
              <div className="e2-sec__body">
                <p className="e2-05-caption">
                  Quand c&apos;est fini, préviens le client dans la messagerie : il confirme la fin et ta part est
                  versée sur ton portefeuille.
                </p>
                {actions.reportProblem ? (
                  <Link className="e2-link e2-link--quiet" href={REPORT_HREF}>
                    <Icon name="i-flag" />
                    Signaler un problème
                  </Link>
                ) : null}
              </div>
            </section>
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
                  {client.city ? <div className="e2-who__sub">{client.city}</div> : null}
                </div>
              </div>
              <div className="e2-05-actions">
                {actions.writeToClient ? (
                  <Link className="e2-link" href={studentConversationHref(mission.id)}>
                    <Icon name="i-message" />
                    Écrire au client
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
