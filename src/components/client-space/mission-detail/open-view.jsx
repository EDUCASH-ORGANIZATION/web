import { MissionDetailTabs } from "@/components/client/mission-detail-tabs"
import { MissionHeader } from "./mission-header"
import { missionView, toLegacyTabsProps } from "@/lib/client-space/mission-view"

// BOUCHON (ST-09) de la vue C04 : garde la parité fonctionnelle (accepter, refuser) en enveloppant l'ancien
// composant, jusqu'à son remplacement par ST-10. Signature figée : `candidate` (tiroir C05) et `flags`
// ({ confirmer, publiee, paymentsEnabled, candidateError? }) seront consommés par ST-10.
// `flags.candidateError` (optionnel, true) : la lecture du candidat demandé a échoué, `candidate` vaut null
// et la vue doit afficher que le profil est indisponible sans bloquer le reste de la page.
export function MissionOpenView({ detail }) {
  const view = missionView(detail)
  return (
    <div>
      <MissionHeader mission={detail.mission} status={view.status} />
      <MissionDetailTabs {...toLegacyTabsProps(detail)} />
    </div>
  )
}

export default MissionOpenView
