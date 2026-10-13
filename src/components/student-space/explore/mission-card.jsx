// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { splitAmount } from "@/components/app-ui/amount"
import { missionTypeLabel } from "@/lib/constants/missions"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"
import { formatAmount, formatShortDate } from "@/lib/app/format"
import { applicationStatusView } from "@/lib/app/application-status"
import { studentMissionHref } from "@/lib/app/student-routes"

/**
 * Carte de mission de l'explorateur (E02). `mission.net` est le gain de l'étudiant (escrowSplit), montant
 * principal ; le budget du client reste en petite ligne. Composant pur.
 * @param {{ mission: { id: string, title: string, type: string, city: string|null, budget: number, net: number,
 *   urgent: boolean, deadline: string|null, applicationStatus: "pending"|"accepted"|"rejected"|null } }} props
 */
export function MissionCard({ mission }) {
  const deadline = formatShortDate(mission.deadline)
  const applied = mission.applicationStatus ? applicationStatusView(mission.applicationStatus) : null
  const { text, unit } = splitAmount(mission.net)
  const typeLabel = missionTypeLabel(mission.type)

  return (
    <article className="e2-mcard">
      <div className="e2-mcard__top">
        <span className="e2-mcard__type">
          <Icon name={TYPE_ICON[mission.type] ?? "i-briefcase"} />
          {typeLabel}
        </span>
        {applied ? (
          <StatusBadge label={applied.label} tone={applied.tone} />
        ) : mission.urgent ? (
          <span className="badge badge--neutre badge--sm">
            <Icon name="i-zap" />
            Urgent
          </span>
        ) : null}
      </div>
      <h3 className="e2-mcard__title">{mission.title}</h3>
      <div className="e2-mcard__meta">
        {mission.city ? (
          <span>
            <Icon name="i-map-pin" />
            {mission.city}
          </span>
        ) : null}
        {deadline ? (
          <span>
            <Icon name="i-calendar" />
            {`Avant le ${deadline}`}
          </span>
        ) : null}
        {applied && mission.urgent ? (
          <span>
            <Icon name="i-zap" />
            Urgent
          </span>
        ) : null}
      </div>
      <div className="e2-mcard__foot">
        <div className="e2-mcard__gain">
          <span className="e2-amount e2-amount--m">
            {text}
            <small>{unit}</small>
          </span>
          <small>{`Budget client ${formatAmount(mission.budget)}`}</small>
        </div>
        <Link className="e2-link" href={studentMissionHref(mission.id)}>
          {applied ? "Suivre" : "Voir"}
          <Icon name="i-arrow-right" />
          <span className="sr-only">{` ${mission.title}`}</span>
        </Link>
      </div>
    </article>
  )
}

export default MissionCard
