// @ds-screen RD-STUDENT-01
import { ItemList, Item } from "@/components/app-ui/item-list"
import { escrowSplit } from "@/lib/app/money"
import { formatAmount } from "@/lib/app/format"
import { studentMissionHref, studentMissionsHref } from "@/lib/app/student-routes"
import { missionTypeLabel } from "@/lib/constants/missions"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"

/**
 * Missions ouvertes du même type, en liste sobre : gain net en montant principal, budget du client en petite
 * ligne. Composant pur ; rien n'est rendu sans mission.
 * @param {{ missions: Array<{ id: string, title: string, type: string, city: string|null, budget: number }>, type: string }} props
 */
export function SimilarMissions({ missions, type }) {
  if (!Array.isArray(missions) || missions.length === 0) return null
  return (
    <ItemList
      title="Missions similaires"
      count={missions.length}
      more={{ href: studentMissionsHref({ type }), label: "Tout voir" }}
    >
      {missions.map((m) => (
        <Item
          key={m.id}
          icon={TYPE_ICON[m.type] ?? "i-briefcase"}
          title={m.title}
          subtitle={[m.city, `budget client ${formatAmount(m.budget)}`].filter(Boolean).join(" · ")}
          amount={escrowSplit(m.budget).student}
          action={{ href: studentMissionHref(m.id), label: "Voir" }}
        />
      ))}
    </ItemList>
  )
}

export default SimilarMissions
