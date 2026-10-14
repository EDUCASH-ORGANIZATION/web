// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { EmptyState } from "@/components/app-ui/empty-state"
import { MissionHeader } from "./mission-header"
import { ApplyPanel } from "./apply/apply-form"
import { ClientCard } from "./apply/client-card"
import { GainRecap } from "./apply/gain-recap"
import { SimilarMissions } from "./apply/similar-missions"
import { missionDetailView } from "@/lib/student-space/mission-view"
import { missionTypeLabel } from "@/lib/constants/missions"
import { formatDateFr } from "@/lib/app/format"
import { studentMissionsHref, studentVerifyHref } from "@/lib/app/student-routes"

const REPORT_HREF = "/contact?sujet=question"

// Explication affichée quand la vérification ou l'échéance empêche (ou menace) la candidature.
const VERIFICATION_NOTES = {
  not_submitted: {
    title: "Envoyez votre carte étudiante pour postuler",
    text: "Vous pourrez postuler dès que votre carte sera envoyée.",
  },
  rejected: { title: "Votre carte a été refusée", text: "Renvoyez une carte lisible pour pouvoir postuler." },
  expired: { title: "Votre badge a expiré", text: "Renouvelez-le pour pouvoir postuler." },
}

function expiringText(daysLeft) {
  const left =
    daysLeft === 0 ? "Il expire aujourd'hui." : `Il reste ${daysLeft} jour${daysLeft > 1 ? "s" : ""}.`
  return `${left} Renouvelez-le pour garder votre badge vérifié.`
}

function Note({ icon, title, text, action }) {
  return (
    <div className="e2-note">
      <Icon name={icon} />
      <div className="e2-note__body">
        <div className="e2-note__title">{title}</div>
        <div className="e2-note__text">{text}</div>
        {action ? (
          <div className="e2-note__actions">
            <Link className="e2-link" href={action.href}>
              <Icon name="i-shield" />
              {action.label}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Note d'état (vérification bloquante, badge qui expire, échéance dépassée), ou null si rien à dire. */
function stateNote({ mode, verification }) {
  if (mode === "overdue") {
    return <Note icon="i-calendar" title="L'échéance est dépassée" text="Cette mission ne reçoit plus de candidatures." />
  }
  if (!verification || mode === "applied") return null
  if (mode === "blocked") {
    const copy = VERIFICATION_NOTES[verification.key] ?? VERIFICATION_NOTES.not_submitted
    return <Note icon="i-id-card" title={copy.title} text={copy.text} />
  }
  if (verification.key === "expiring") {
    return (
      <Note
        icon="i-shield"
        title="Votre badge arrive à échéance"
        text={expiringText(verification.daysLeft ?? 0)}
        action={verification.action ?? { label: "Renouveler mon badge", href: studentVerifyHref() }}
      />
    )
  }
  return null
}

function panelMode(view, application) {
  if (application) return "applied"
  if (view.deadlinePassed) return "overdue"
  if (view.actions.needsVerification) return "blocked"
  if (view.actions.canApply) return "form"
  return "blocked"
}

function DetailsSection({ mission }) {
  const rows = [
    ["Type", missionTypeLabel(mission.type)],
    mission.city ? ["Lieu", mission.city] : null,
    mission.deadline ? ["Échéance", formatDateFr(mission.deadline)] : null,
    mission.urgency === "high" ? ["Urgence", "Urgente"] : null,
  ].filter(Boolean)
  return (
    <section className="e2-sec" aria-label="Détails">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Détails</h2>
      </div>
      <div className="e2-sec__body">
        <div className="e2-kv">
          {rows.map(([label, value]) => (
            <div className="e2-kv__row" key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * E03 Détail de mission et candidature, d'après la planche v2.1 : sous-page de Missions. Le bureau a le bloc de
 * candidature en colonne ; en mobile une barre fixe ouvre la feuille de candidature.
 *
 * `detail` : forme de `getStudentMissionDetail` (`@/lib/actions/student-mission-detail.actions`). Seuls les états
 * "open" et "closed" arrivent ici ("closed" ne porte que l'identifiant : aucun titre ni montant n'est affiché).
 * `flags` = { postuler: ?postuler=1, ouvre la feuille de candidature en mobile sans rien envoyer ;
 * paymentsEnabled: PAYMENTS_ENABLED }.
 *
 * L'interface ne fait que refléter le contrôle de l'action `apply` (rôle, vérification de la carte, mission
 * ouverte, pas déjà candidat) : elle n'est jamais une autorité.
 *
 * @param {{ detail: import("@/lib/actions/student-mission-detail.actions").StudentMissionDetail,
 *   flags: { postuler: boolean, paymentsEnabled: boolean } }} props
 */
export function MissionApplyView({ detail, flags }) {
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
  const { type: missionType } = mission
  const mode = panelMode(view, application)
  const note = stateNote({ mode, verification })
  const back = { href: studentMissionsHref(), label: "Missions" }

  return (
    <>
      <header className="e2-mtop">
        <Link className="iconbtn2" href={back.href} aria-label="Retour aux missions">
          <Icon name="i-arrow-left" />
        </Link>
        <span className="e2-mtop__title">Détail de la mission</span>
        <Link className="iconbtn2" href={REPORT_HREF} aria-label="Signaler cette mission">
          <Icon name="i-flag" />
        </Link>
      </header>
      <MissionHeader mission={mission} status={view.status} back={back} />
      {note ? <div className="ds-mob-only">{note}</div> : null}
      <div className="e2-cols">
        <div className="e2-stack">
          <section className="e2-sec" aria-label="Description">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Description</h2>
            </div>
            <div className="e2-sec__body">
              <p className="e2-text e2-03-desc">{mission.description}</p>
            </div>
          </section>
          <DetailsSection mission={mission} />
          <section className="e2-sec ds-mob-only" aria-label="Ce que vous touchez">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Ce que vous touchez</h2>
            </div>
            <div className="e2-sec__body">
              <GainRecap split={view.split} />
            </div>
          </section>
          <ClientCard client={client} budget={mission.budget} />
          <SimilarMissions missions={similar} type={missionType} />
          <div>
            <Link className="e2-link e2-link--quiet" href={REPORT_HREF}>
              <Icon name="i-flag" />
              Signaler cette mission
            </Link>
          </div>
        </div>
        <aside className="e2-03-aside">
          <ApplyPanel
            mode={mode}
            mission={{ id: mission.id, title: mission.title }}
            clientName={client.name}
            split={view.split}
            verification={verification}
            application={
              application
                ? { status: application.status, createdAt: application.createdAt, message: application.message }
                : null
            }
            note={note}
            initialSheet={flags?.postuler === true}
          />
        </aside>
      </div>
    </>
  )
}

export default MissionApplyView
