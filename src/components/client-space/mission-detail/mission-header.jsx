import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Amount } from "@/components/app-ui/amount"
import { missionTypeLabel } from "@/lib/constants/missions"
import { formatDateFr } from "@/lib/app/format"
import { purchasesLine } from "@/lib/app/purchases"
import { clientMissionsHref } from "@/lib/app/client-routes"

// En-tête partagé du détail de mission (C04, C08, C11) : fil d'Ariane, titre unique, statut, type, ville,
// échéance et montant. `status` vient de missionStatusView ; `actions` (optionnel) se place à droite du titre.
// Le montant est dit « en séquestre » tant que la mission est ouverte ou en cours, sinon « Budget ».
export function MissionHeader({ mission, status, actions }) {
  const escrowed = mission.status === "open" || mission.status === "in_progress"
  // Mission avec achats : une ligne d'information seulement si l'estimation est positive, sinon rien.
  const purchases = purchasesLine(mission.purchasesEstimate)
  return (
    <header>
      <PageHead
        date={
          <nav aria-label="Fil d'Ariane" className="meta2">
            <Link href={clientMissionsHref()}>Mes missions</Link>
            <Icon name="i-chevron-right" className="ic" />
            <span aria-current="page">Mission</span>
          </nav>
        }
        title={mission.title}
        actions={actions}
      />
      <div className="meta2">
        <StatusBadge label={status.label} tone={status.tone} />
        <span>{missionTypeLabel(mission.type)}</span>
        {mission.city ? (
          <span>
            <Icon name="i-map-pin" className="ic" />
            {mission.city}
          </span>
        ) : null}
        {mission.deadline ? (
          <span>
            <Icon name="i-calendar" className="ic" />
            Échéance : {formatDateFr(mission.deadline)}
          </span>
        ) : null}
        <span>
          {escrowed ? "En séquestre : " : "Budget : "}
          <Amount value={mission.budget} size="s" />
        </span>
        {purchases ? (
          <span>
            <Icon name="i-receipt" className="ic" />
            {purchases}
          </span>
        ) : null}
      </div>
    </header>
  )
}

export default MissionHeader
