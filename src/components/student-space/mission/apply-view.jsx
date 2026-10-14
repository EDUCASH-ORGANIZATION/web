// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { EmptyState } from "@/components/app-ui/empty-state"
import { Avatar } from "@/components/app-ui/avatar"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { StudentApplyForm } from "@/components/missions/student-apply-form"
import { MissionHeader } from "./mission-header"
import { missionDetailView } from "@/lib/student-space/mission-view"
import { missionTypeLabel } from "@/lib/constants/missions"
import { formatFcfa } from "@/lib/app/format"
import { applicationStatusView } from "@/lib/app/application-status"
import { studentMissionHref, studentMissionsHref } from "@/lib/app/student-routes"

/**
 * E03 Détail de mission et candidature : BOUCHON DE PARITÉ (ST-08), remplacé par ST-10. La signature est figée.
 * Il porte l'aiguillage « plus ouverte » et enveloppe l'ancien formulaire de candidature (`StudentApplyForm`).
 *
 * Contrat de `detail` (forme de `getStudentMissionDetail`, `@/lib/actions/student-mission-detail.actions`) :
 * - `detail.state` : "open" (mission ouverte, étudiant non retenu ou candidat), "closed" (mission non ouverte dont
 *   l'étudiant n'est pas le retenu : `detail.mission = { id }` SEULEMENT, aucun autre champ) ;
 *   "selected" n'arrive pas ici (E05).
 * - `detail.mission` : { id, title, description, type (missionTypeLabel), city, budget (FCFA, part étudiant par
 *   escrowSplit), urgency, deadline "AAAA-MM-JJ"|null, status, createdAt (ISO) }.
 * - `detail.client` : { name (prénom et initiale), avatarUrl, city, rating (0 si aucun avis), missionsPublished,
 *   isVerified } : jamais téléphone ni email.
 * - `detail.application` : { id, status, message, createdAt, updatedAt } de l'étudiant connecté, sinon null.
 * - `detail.verification` : { key, label, canApply, daysLeft, action: { label, href }|null } calculé côté
 *   serveur (6 clés : not_submitted, pending, verified, expiring, expired, rejected). Aucune colonne brute.
 * - `detail.similar` : [{ id, title, type, city, budget }] (4 au plus).
 * - `detail.isSelected`, `detail.ledger`, `detail.review` : sans objet en E03.
 * Calculs purs : `missionDetailView(detail)` de `@/lib/student-space/mission-view` ({ status, split, actions }).
 *
 * `flags` = { postuler: boolean (?postuler=1 : ouvre la feuille de candidature en mobile),
 *   paymentsEnabled: boolean (PAYMENTS_ENABLED) }.
 *
 * Contrôle serveur : l'action `apply` refuse déjà l'étudiant qui ne peut pas postuler (décision D2) ; l'interface
 * ne fait que le refléter.
 *
 * @param {{ detail: import("@/lib/actions/student-mission-detail.actions").StudentMissionDetail,
 *   flags: { postuler: boolean, paymentsEnabled: boolean } }} props
 */
export function MissionApplyView({ detail }) {
  const view = missionDetailView(detail)
  if (view.closed || detail.mission.status !== "open") {
    return (
      <EmptyState
        titleAs="h1"
        icon="i-briefcase"
        title="Cette mission n'est plus ouverte"
        text="Elle ne reçoit plus de candidatures."
        action={{ href: studentMissionsHref(), label: "Voir d'autres missions" }}
      />
    )
  }

  const { mission, client, application, verification, similar } = detail
  const applied = application ? applicationStatusView(application.status) : null

  return (
    <>
      <MissionHeader mission={mission} status={view.status} back={{ href: studentMissionsHref(), label: "Missions" }} />
      <div className="e2-cols">
        <div className="e2-stack">
          <section className="e2-sec" aria-label="Description">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Description</h2>
            </div>
            <div className="e2-sec__body">
              <p className="e2-text">{mission.description}</p>
            </div>
          </section>
          <section className="e2-sec" aria-label="Le client">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Le client</h2>
            </div>
            <div className="e2-sec__body">
              <div className="e2-who">
                <Avatar name={client.name} src={client.avatarUrl} verified={client.isVerified} />
                <div>
                  <div className="e2-who__name">{client.name}</div>
                  <div className="e2-who__sub">
                    {[client.city, client.rating > 0 ? `${client.rating.toFixed(1)} / 5` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </div>
            </div>
          </section>
          {similar.length > 0 ? (
            <section className="e2-sec" aria-label="Missions similaires">
              <div className="e2-sec__head">
                <h2 className="e2-sec__title">Missions similaires</h2>
              </div>
              <ul className="e2-sec__body">
                {similar.map((m) => (
                  <li key={m.id}>
                    <Link className="e2-link" href={studentMissionHref(m.id)}>
                      {m.title}
                    </Link>
                    <span className="e2-muted">{` ${missionTypeLabel(m.type)} · ${formatFcfa(m.budget)}`}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <aside className="e2-03-aside">
          <section className="e2-sec" aria-label="Postuler">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Postuler</h2>
              {applied ? <StatusBadge label={applied.label} tone={applied.tone} /> : null}
            </div>
            <div className="e2-sec__body">
              {verification && !verification.canApply ? (
                <p className="e2-03-caption">
                  {verification.label}
                  {verification.action ? (
                    <>
                      {" "}
                      <Link className="e2-link" href={verification.action.href}>
                        <Icon name="i-shield" />
                        {verification.action.label}
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
              <StudentApplyForm
                missionId={mission.id}
                budget={mission.budget}
                clientName={client.name}
                estimatedDuration={null}
                alreadyApplied={Boolean(application)}
                isVerified={Boolean(verification?.canApply)}
              />
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}

export default MissionApplyView
