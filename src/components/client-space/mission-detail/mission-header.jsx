import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { formatDateFr } from "@/lib/app/format"
import { purchasesEstimateOf } from "@/lib/app/purchases"
import { clientMissionsHref } from "@/lib/app/client-routes"

// Onglet de « Mes missions » (libellé de la ligne de date, clé de l'URL) selon le statut de la mission.
const TAB_OF = {
  open: { label: "Ouvertes", key: undefined },
  in_progress: { label: "En cours", key: "in_progress" },
  done: { label: "Terminées", key: "done" },
  cancelled: { label: "Annulées", key: "cancelled" },
}

// En-tête partagé du détail de mission (C04, C08, C11) : ligne « Mes missions · <onglet> » (lien vers l'onglet),
// titre unique, puis la méta de la planche : statut, « Avec achats » si estimation, ville, date. Le type et le
// séquestre vivent dans la colonne droite. `status` vient de missionStatusView ; `actions` (optionnel) se place
// à droite du titre.
export function MissionHeader({ mission, status, actions }) {
  const tab = TAB_OF[mission.status]
  const withPurchases = purchasesEstimateOf(mission.purchasesEstimate) !== null
  const deadline = mission.deadline ? formatDateFr(mission.deadline) : ""
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
            {`${mission.status === "open" ? "Avant le" : "Jusqu'au"} ${deadline}`}
          </span>
        ) : null}
      </div>
    </header>
  )
}

export default MissionHeader
