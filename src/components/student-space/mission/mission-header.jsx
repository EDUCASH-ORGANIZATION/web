// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { missionTypeLabel } from "@/lib/constants/missions"
import { formatDateFr } from "@/lib/app/format"
import { purchasesLine } from "@/lib/app/purchases"

/**
 * En-tête partagé du détail de mission étudiant (E03 et E05) : lien de retour, type et date de publication,
 * titre (seul h1, Anton), statut, ville et échéance. Composant pur.
 * @param {{
 *   mission: { title: string, type: string, city: string|null, deadline: string|null, createdAt: string,
 *     purchasesEstimate?: number|null },
 *   status: { label: string, tone: string },
 *   back: { href: string, label: string },
 *   variant?: "03" | "05"
 * }} props `variant` choisit la famille de classes de la planche (E03 ou E05)
 */
export function MissionHeader({ mission, status, back, variant = "03" }) {
  const published = mission.createdAt ? formatDateFr(mission.createdAt) : ""
  const deadline = mission.deadline ? formatDateFr(mission.deadline) : ""
  // Mission avec achats : une ligne d'information seulement si l'estimation est positive, sinon rien.
  const purchases = purchasesLine(mission.purchasesEstimate)
  return (
    <header className={`e2-${variant}-top`}>
      <Link className="e2-back" href={back.href}>
        <Icon name="i-arrow-left" />
        {back.label}
      </Link>
      <PageHead
        date={`${missionTypeLabel(mission.type)}${published ? ` · Publiée le ${published}` : ""}`}
        title={mission.title}
      />
      <div className={`e2-${variant}-meta`}>
        <StatusBadge label={status.label} tone={status.tone} />
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
        {purchases ? (
          <span>
            <Icon name="i-receipt" />
            {purchases}
          </span>
        ) : null}
      </div>
    </header>
  )
}

export default MissionHeader
