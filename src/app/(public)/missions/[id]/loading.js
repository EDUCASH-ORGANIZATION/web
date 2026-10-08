import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"

export default function MissionDetailLoading() {
  return (
    <div className="ds">
      <VitrineNavbar />

      <main aria-busy="true">
        <div className="v03-wrap v03-with-bar">
          <div className="skel skel--text w-1/3" />
          <div className="v03-grid">
            <div className="stack stack--6">
              <div className="stack stack--3">
                <div className="row">
                  <div className="skel skel--pill w-36 h-7" />
                  <div className="skel skel--pill w-24 h-7" />
                </div>
                <div className="skel skel--title w-5/6" />
                <div className="skel skel--text w-2/3" />
              </div>
              <div className="skel-card">
                <div className="skel skel--text w-1/4" />
                <div className="skel skel--text w-full" />
                <div className="skel skel--text w-full" />
                <div className="skel skel--text w-4/5" />
              </div>
              <div className="skel-card">
                <div className="skel skel--text w-1/3" />
                <div className="skel skel--text w-1/2" />
              </div>
            </div>
            <div className="skel-card ds-desk-only">
              <div className="skel skel--block w-full h-24" />
              <div className="skel skel--text w-full" />
              <div className="skel skel--text w-3/4" />
              <div className="skel skel--pill w-full h-12" />
            </div>
          </div>
        </div>
      </main>

      <VitrineFooter />
    </div>
  )
}
