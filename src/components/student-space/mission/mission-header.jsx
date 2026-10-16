// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { missionTypeLabel } from "@/lib/constants/missions"
import { safeDateFr } from "@/lib/student-space/mission-view"
import { purchasesEstimateOf, purchasesLine } from "@/lib/app/purchases"

/**
 * En-tête partagé du détail de mission étudiant (E03 et E05) : lien de retour, ligne de date, titre (seul h1,
 * Anton), puis la méta de la planche : ville, échéance, badge « Urgent » (mission ouverte urgente), badge « Avec achats »
 * si estimation. Pas de badge de statut (il est dans la carte de suivi). Aucun nombre de candidats : l'étudiant ne lit
 * que sa propre candidature (confidentialité). Composant pur.
 * E03 : « <type> · Publiée le <date> » ; E05 : « <type> · retenue <quand> » seulement si `retainedAt` existe.
 * @param {{
 *   mission: { title: string, type: string, city: string|null, deadline: string|null, createdAt: string,
 *     purchasesEstimate?: number|null, urgency?: string|null, status?: string },
 *   back: { href: string, label: string },
 *   variant?: "03" | "05",
 *   retainedAt?: string|null,
 *   withPurchasesLine?: boolean
 * }} props `variant` choisit la famille de classes de la planche (E03 ou E05) ;
 * `withPurchasesLine` (défaut true) affiche la ligne « Achats estimés » sous la méta : les vues qui ont leurs propres
 * cartes d'achats la coupent
 */
export function MissionHeader({ mission, back, variant = "03", retainedAt = null, withPurchasesLine = true }) {
  const deadline = safeDateFr(mission.deadline)
  const withPurchases = purchasesEstimateOf(mission.purchasesEstimate) !== null
  const purchases = purchasesLine(mission.purchasesEstimate)
  const urgent = mission.status === "open" && mission.urgency === "high"
  const deadlinePrefix = variant === "05" ? (mission.status === "in_progress" ? "Jusqu'au " : "") : "Avant le "
  const type = missionTypeLabel(mission.type)
  let dateLine = type
  const published = safeDateFr(mission.createdAt)
  const retained = safeDateFr(retainedAt)
  if (variant === "03" && published) dateLine = `${type} · Publiée le ${published}`
  if (variant === "05" && retained) dateLine = `${type} · retenue le ${retained}`
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
            {`${deadlinePrefix}${deadline}`}
          </span>
        ) : null}
        {urgent ? <StatusBadge label="Urgent" icon="i-zap" /> : null}
        {withPurchases ? <StatusBadge label="Avec achats" icon="i-receipt" /> : null}
      </div>
      {withPurchasesLine && purchases ? <p className="body-s">{purchases}</p> : null}
    </header>
  )
}

export default MissionHeader
