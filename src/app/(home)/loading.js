import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"

const CARDS = [0, 1, 2]

// Squelette de l'accueil : le hero et les blocs statiques s'affichent tout de suite,
// seul l'aperçu des missions attend les données.
export default function HomeLoading() {
  return (
    <VitrinePage navbar={<VitrineNavbar tone="bleu" />}>
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
      <section className="section">
        <div className="v02-grid">
          {CARDS.map((i) => (
            <div key={i} className="skel-card">
              <div className="row row--between">
                <span className="skel skel--pill w-[150px] h-[28px]" />
                <span className="skel skel--pill w-[70px] h-[22px]" />
              </div>
              <span className="skel skel--title w-[90%]" />
              <span className="skel skel--text w-[60%]" />
              <span className="skel skel--text w-[45%]" />
              <div className="divider divider--dash" />
              <div className="row row--between">
                <span className="skel skel--title w-[120px] h-[28px]" />
                <span className="skel skel--pill w-[64px] h-[36px]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </VitrinePage>
  )
}
