// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { MissionHeader } from "./mission-header"
import { missionDetailView } from "@/lib/student-space/mission-view"
import { formatFcfa } from "@/lib/app/format"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { studentApplicationsHref, studentConversationHref, studentReviewHref } from "@/lib/app/student-routes"

const REPORT_HREF = "/contact?sujet=question"
const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

/**
 * E05 Mission retenue, suivi : BOUCHON DE PARITÉ (ST-08), remplacé par ST-11. La signature est figée.
 *
 * Contrat de `detail` (forme de `getStudentMissionDetail`, `@/lib/actions/student-mission-detail.actions`) :
 * - `detail.state` = "selected" : l'étudiant connecté est le retenu d'une mission non ouverte (in_progress, done
 *   ou cancelled). Les mêmes champs que pour E03 (`mission`, `client`, `application`, `isSelected`), plus :
 * - `detail.ledger` : [{ type: "release", amount, createdAt }] lignes du grand livre de CETTE mission sous le
 *   user_id de l'étudiant (release = son NET, jamais la ligne brute du client ni la commission) ; vide si le
 *   paiement n'est pas encore écrit.
 * - `detail.review` : { id, rating, comment, createdAt } avis déjà donné par l'étudiant, sinon null.
 * - `detail.application.createdAt` (candidature) et `detail.application.updatedAt` (retenue) : dates connues.
 * - `detail.verification` est null et `detail.similar` vide dans cet état.
 * Calculs purs : `missionDetailView(detail)` de `@/lib/student-space/mission-view` donne { status, split
 * (escrowSplit), actions ({ writeToClient, reportProblem, rate, viewReview }), timeline (applied, selected, paid,
 * reviewed avec state done|now|todo et date), receipt ({ hasLedger, net: number|null, date }) }.
 * Aucun bouton « J'ai terminé » ni état « À confirmer » (aucune donnée en base).
 *
 * `flags` = { postuler: boolean, paymentsEnabled: boolean } (`postuler` sans objet ici).
 *
 * @param {{ detail: import("@/lib/actions/student-mission-detail.actions").StudentMissionDetailOpen,
 *   flags: { postuler: boolean, paymentsEnabled: boolean } }} props
 */
export function MissionFollowupView({ detail }) {
  const view = missionDetailView(detail)
  const { mission, client } = detail
  const { actions, split, receipt } = view
  const cancelled = mission.status === "cancelled"

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
          <section className="e2-sec" aria-label="Ce que tu touches">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Ce que tu touches</h2>
            </div>
            <div className="e2-sec__body">
              {cancelled ? (
                <p className="e2-05-caption">Cette mission a été annulée : aucun montant ne t&apos;est dû.</p>
              ) : (
                <div className="e2-kv">
                  <div className="e2-kv__row">
                    <span>Budget du client (100 %)</span>
                    <b>{formatFcfa(split.total)}</b>
                  </div>
                  <div className="e2-kv__row">
                    <span>{`Commission EduCash (${COMMISSION_PERCENT} %)`}</span>
                    <b>{`− ${formatFcfa(split.commission)}`}</b>
                  </div>
                  <div className="e2-kv__row e2-kv__row--total">
                    <span>{`Tu touches (${100 - COMMISSION_PERCENT} %)`}</span>
                    <b>
                      {mission.status === "done"
                        ? receipt.net === null
                          ? "Paiement en cours de traitement"
                          : formatFcfa(receipt.net)
                        : formatFcfa(split.student)}
                    </b>
                  </div>
                </div>
              )}
              {mission.status === "in_progress" ? (
                <p className="e2-05-caption">
                  Quand c&apos;est fini, préviens le client dans la messagerie : il confirme la fin de la mission et
                  ta part est versée sur ton portefeuille.
                </p>
              ) : null}
            </div>
          </section>
        </div>
        <aside className="e2-stack e2-05-aside">
          <section className="e2-sec" aria-label="Le client">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Le client</h2>
            </div>
            <div className="e2-sec__body">
              <div className="e2-who">
                <Avatar name={client.name} src={client.avatarUrl} verified={client.isVerified} />
                <div className="e2-05-min">
                  <div className="e2-who__name">{client.name}</div>
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
                {actions.reportProblem ? (
                  <Link className="e2-link e2-link--quiet" href={REPORT_HREF}>
                    <Icon name="i-flag" />
                    Signaler un problème
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}

export default MissionFollowupView
