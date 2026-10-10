import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"

// Squelette de l'accueil : reprend le hero bleu. Aucun id d'ancre, la page réelle prend le relais.
export default function HomeLoading() {
  return (
    <VitrinePage audience="clients" navbar={<VitrineNavbar tone="bleu" audience="clients" />}>
      <div className="hero hero--under-header grid-bg" aria-busy="true">
        <div className="v-hero">
          <div className="stack stack--4">
            <div className="skel skel--pill w-[150px] h-[28px]" />
            <div className="skel skel--block w-[90%] h-[40px]" />
            <div className="skel skel--text w-[60%]" />
            <div className="skel skel--pill w-[90%] h-[40px]" />
          </div>
        </div>
      </div>
    </VitrinePage>
  )
}
