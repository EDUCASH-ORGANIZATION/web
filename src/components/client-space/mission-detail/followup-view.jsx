import { MissionDetailTabs } from "@/components/client/mission-detail-tabs"
import { MissionHeader } from "./mission-header"
import { missionView, toLegacyTabsProps } from "@/lib/client-space/mission-view"

// BOUCHON (ST-09) des vues C08, C09 et C11 : garde la parité fonctionnelle (confirmer la fin) en enveloppant
// l'ancien composant, jusqu'à son remplacement par ST-11. Signature figée : `flags`
// ({ confirmer, publiee, paymentsEnabled }) sera consommé par ST-11.
export function MissionFollowupView({ detail }) {
  const view = missionView(detail)
  return (
    <div>
      <MissionHeader mission={detail.mission} status={view.status} />
      <MissionDetailTabs {...toLegacyTabsProps(detail)} />
    </div>
  )
}

export default MissionFollowupView
