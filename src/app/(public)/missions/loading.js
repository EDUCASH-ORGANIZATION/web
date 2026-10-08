import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"

const CHIPS = ["w-24", "w-36", "w-28", "w-32", "w-22"]
const CARDS = Array.from({ length: 6 }, (_, i) => i)

export default function MissionsPublicLoading() {
  return (
    <div className="ds">
      <VitrineNavbar />

      <main aria-busy="true">
        <div className="v02-head grid-bg">
          <div className="stack stack--3">
            <div className="skel skel--pill w-40 h-7" />
            <div className="skel skel--block w-4/5 max-w-105 h-14" />
          </div>
          <div className="skel skel--pill v02-search h-14" />
          <div className="row v02-types">
            {CHIPS.map((w) => (
              <div key={w} className={`skel skel--pill h-9 ${w}`} />
            ))}
          </div>
        </div>

        <div className="v02-body">
          <div className="v02-grid">
            {CARDS.map((i) => (
              <div key={i} className="skel-card">
                <div className="skel skel--pill w-2/5 h-6" />
                <div className="skel skel--title w-5/6" />
                <div className="skel skel--text w-2/3" />
                <div className="skel skel--text w-1/2" />
                <div className="skel skel--pill w-full h-10" />
              </div>
            ))}
          </div>
        </div>
      </main>

      <VitrineFooter />
    </div>
  )
}
