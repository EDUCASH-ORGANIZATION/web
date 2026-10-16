import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { formatDateFr } from "@/lib/app/format"
import { missionTypeLabel } from "@/lib/constants/missions"
import { purchasesEstimateOf, purchasesLine } from "@/lib/app/purchases"
import { clientMissionsHref } from "@/lib/app/client-routes"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"

// Onglet de « Mes missions » (libellé de la ligne de date, clé de l'URL) selon le statut de la mission.
const TAB_OF = {
  open: { label: "Ouvertes", key: undefined },
  in_progress: { label: "En cours", key: "in_progress" },
  done: { label: "Terminées", key: "done" },
  cancelled: { label: "Annulées", key: "cancelled" },
}

// En-tête partagé du détail de mission (C04, C08, C11) : ligne « Mes missions · <onglet> » (lien vers l'onglet),
// titre unique, puis la méta de la planche : statut, « Avec achats » si estimation, ville, date, puis
// « Publiée le » (open) ou le type (autres statuts). Le séquestre vit dans la colonne droite.
// `status` vient de missionStatusView ; `actions` (optionnel) se place à droite du titre. `purchasesLine`
// (défaut vrai) affiche la ligne provisoire des achats estimés ; une vue qui porte déjà l'estimation dans une
// carte (C08, C11) la désactive.
export function MissionHeader({ mission, status, actions, purchasesLine: showPurchasesLine = true }) {
  const tab = TAB_OF[mission.status]
  const withPurchases = purchasesEstimateOf(mission.purchasesEstimate) !== null
  const deadline = mission.deadline ? formatDateFr(mission.deadline) : ""
  const deadlinePrefix = { open: "Avant le ", in_progress: "Jusqu'au " }[mission.status] ?? ""
  const urgent = mission.status === "open" && mission.urgency === "high"
  const published = mission.status === "open" && mission.createdAt ? formatDateFr(mission.createdAt) : ""
  const purchases = purchasesLine(mission.purchasesEstimate)
  const showType = mission.status !== "open" && mission.type
  return (
    <header>
      <PageHead
        date={
          tab ? (
            <Link href={clientMissionsHref({ onglet: tab.key })}>{`Mes missions · ${tab.label}`}</Link>
          ) : (
            <Link href={clientMissionsHref()}>Mes missions</Link>
          )
        }
        title={mission.title}
        actions={actions}
      />
      <div className="meta2">
        <StatusBadge label={status.label} tone={status.tone} />
        {urgent ? <StatusBadge label="Urgent" icon="i-zap" /> : null}
        {withPurchases ? <StatusBadge label="Avec achats" icon="i-receipt" /> : null}
        {mission.city ? (
          <span>
            <Icon name="i-map-pin" className="ic" />
            {mission.city}
          </span>
        ) : null}
        {deadline ? (
          <span>
            <Icon name="i-calendar" className="ic" />
            {`${deadlinePrefix}${deadline}`}
          </span>
        ) : null}
        {published ? (
          <span>
            <Icon name="i-clock" className="ic" />
            {`Publiée le ${published}`}
          </span>
        ) : null}
        {showType ? (
          <span>
            <Icon name={TYPE_ICON[mission.type] ?? "i-briefcase"} className="ic" />
            {missionTypeLabel(mission.type)}
          </span>
        ) : null}
      </div>
      {/* Provisoire : migre vers les cartes en ST-08/ST-09/ST-11/ST-12 */}
      {showPurchasesLine && purchases ? <p className="body-s">{purchases}</p> : null}
    </header>
  )
}

export default MissionHeader
