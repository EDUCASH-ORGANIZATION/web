// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { missionTypeLabel } from "@/lib/constants/missions"
import { formatDateFr } from "@/lib/app/format"
import { purchasesEstimateOf } from "@/lib/app/purchases"

/**
 * En-tête partagé du détail de mission étudiant (E03 et E05) : lien de retour, ligne de date, titre (seul h1,
 * Anton), puis la méta de la planche : ville, échéance, nombre de candidats si fourni, badge « Avec achats »
 * si estimation. Pas de badge de statut (il est dans la carte de suivi). Composant pur.
 * E03 : « <type> · Publiée le <date> » ; E05 : « <type> · retenue <quand> » seulement si `retainedAt` existe.
 * @param {{
 *   mission: { title: string, type: string, city: string|null, deadline: string|null, createdAt: string,
 *     purchasesEstimate?: number|null, applicationsCount?: number|null },
 *   back: { href: string, label: string },
 *   variant?: "03" | "05",
 *   retainedAt?: string|null
 * }} props `variant` choisit la famille de classes de la planche (E03 ou E05)
 */
export function MissionHeader({ mission, back, variant = "03", retainedAt = null }) {
  const deadline = mission.deadline ? formatDateFr(mission.deadline) : ""
  const withPurchases = purchasesEstimateOf(mission.purchasesEstimate) !== null
  const count = Number.isInteger(mission.applicationsCount) && mission.applicationsCount > 0 ? mission.applicationsCount : 0
  const type = missionTypeLabel(mission.type)
  let dateLine = type
  if (variant === "03" && mission.createdAt) dateLine = `${type} · Publiée le ${formatDateFr(mission.createdAt)}`
  if (variant === "05" && retainedAt) dateLine = `${type} · retenue le ${formatDateFr(retainedAt)}`
  return (
    <header className={`e2-${variant}-top`}>
      <Link className="e2-back" href={back.href}>
        <Icon name="i-arrow-left" />
        {back.label}
      </Link>
      <PageHead date={dateLine} title={mission.title} />
      <div className={`e2-${variant}-meta`}>
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
        {variant === "03" && count > 0 ? (
          <span>
            <Icon name="i-users" />
            {`${count} ${count > 1 ? "candidats" : "candidat"}`}
          </span>
        ) : null}
        {withPurchases ? <StatusBadge label="Avec achats" icon="i-receipt" /> : null}
      </div>
    </header>
  )
}

export default MissionHeader
