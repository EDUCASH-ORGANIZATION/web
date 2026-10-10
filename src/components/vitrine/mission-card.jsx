import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { netAmount, missionTypeLabel } from "@/lib/constants/missions"
import { fmtInt } from "@/lib/vitrine/format"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"

function fmtDateLabel(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const day = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
  return `Avant le ${day}`
}

function fmtPublished(value) {
  if (!value) return null
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff)) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  if (days > 0) return `Publiée il y a ${days} j`
  if (hours > 0) return `Publiée il y a ${hours} h`
  return "Publiée à l'instant"
}

/**
 * Carte mission de la refonte (classe .mission du design system).
 * Composant serveur : rend un lien.
 */
export function MissionCard({ mission }) {
  const budget = mission.budget ?? 0
  const net = netAmount(budget)
  const isUrgent = mission.urgency === "high"
  const typeIcon = TYPE_ICON[mission.type] ?? "i-briefcase"
  const dateLabel = fmtDateLabel(mission.deadline)
  const published = fmtPublished(mission.created_at)

  return (
    <Link className="mission mission--link" href={`/missions/${mission.id}`}>
      <div className="mission__top">
        <span className="mission__cat">
          <span className="ic-sq ic-sq--sm"><Icon name={typeIcon} className="ic" /></span>
          {missionTypeLabel(mission.type)}
        </span>
        {isUrgent ? (
          <span className="badge badge--contour badge--sm"><Icon name="i-zap" className="ic" />Urgent</span>
        ) : (
          <span className="badge badge--bleu badge--sm"><i />Ouverte</span>
        )}
      </div>
      <h3 className="mission__title">{mission.title}</h3>
      <div className="mission__meta">
        {mission.city && (
          <span><Icon name="i-map-pin" className="ic" />{mission.city}</span>
        )}
        {dateLabel && <span><Icon name="i-calendar" className="ic" />{dateLabel}</span>}
        {published && <span><Icon name="i-clock" className="ic" />{published}</span>}
      </div>
      <div className="mission__foot">
        <div className="mission__price">
          <span className="amount amount--m">{fmtInt(budget)}&#8239;<small>FCFA</small></span>
          <small className="net">Tu touches {fmtInt(net)}&#8239;FCFA</small>
        </div>
        <span className="btn btn--primary btn--sm">Voir</span>
      </div>
    </Link>
  )
}