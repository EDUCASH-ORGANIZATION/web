import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const { MissionHeader: ClientHeader } = await import("./client-space/mission-detail/mission-header")
const { MissionHeader: StudentHeader } = await import("./student-space/mission/mission-header")
const { ClientMissionsView } = await import("./client-space/missions-list/client-missions-view")
const { StudentExploreView } = await import("./student-space/explore/explore-view")

const text = (html) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/[  ]/g, " ").replace(/\s+/g, " ")

const clientMission = (over) => ({
  id: "m1", title: "Courses du mois", type: "Livraison", city: "Cotonou", budget: 8000, deadline: "2026-10-20",
  status: "open", createdAt: "2026-10-01T10:00:00Z", ...over,
})
const status = { label: "Ouverte", tone: "bleu" }
const back = { href: "/student/missions", label: "Retour" }

describe("détail client : badge « Avec achats »", () => {
  it("affiche le badge pour une estimation positive, sans montant d'achats ni mention du séquestre", () => {
    const html = text(renderToStaticMarkup(<ClientHeader mission={clientMission({ purchasesEstimate: 15000 })} status={status} />))
    expect(html).toContain("Avec achats")
    expect(html).not.toContain("Achats estimés")
    expect(html).not.toContain("En séquestre")
  })

  it.each([null, undefined, 0, -5, Number.NaN])("n'affiche rien pour %j", (purchasesEstimate) => {
    const html = text(renderToStaticMarkup(<ClientHeader mission={clientMission({ purchasesEstimate })} status={status} />))
    expect(html).not.toContain("Avec achats")
  })
})

describe("détail étudiant : badge « Avec achats »", () => {
  it("affiche le badge pour une estimation positive, quel que soit l'état de la mission", () => {
    for (const s of ["open", "in_progress", "done"]) {
      const html = text(
        renderToStaticMarkup(<StudentHeader mission={clientMission({ status: s, purchasesEstimate: 15000 })} back={back} />),
      )
      expect(html).toContain("Avec achats")
      expect(html).not.toContain("Achats estimés")
    }
  })

  it.each([null, undefined, 0, -1])("n'affiche rien pour %j", (purchasesEstimate) => {
    const html = text(renderToStaticMarkup(<StudentHeader mission={clientMission({ purchasesEstimate })} back={back} />))
    expect(html).not.toContain("Avec achats")
  })
})

describe("listes : pastille « Avec achats »", () => {
  const clientRow = (over) => ({
    id: "m1", title: "Courses du mois", type: "Livraison", city: "Cotonou", budget: 8000, deadline: "2026-10-20",
    status: "open", createdAt: "2026-10-01T10:00:00Z", overdue: false, applicationsCount: 0, pendingCount: 0,
    studentId: null, reviewed: false, ...over,
  })
  const clientList = (missions) =>
    text(
      renderToStaticMarkup(
        <ClientMissionsView
          result={{ onglet: "open", q: "", today: "2026-10-13", counts: { open: 2, in_progress: 0, done: 0, cancelled: 0 }, total: 2, missions }}
        />,
      ),
    )

  it("côté client : seulement pour la mission avec achats", () => {
    const html = clientList([clientRow({ id: "a", withPurchases: true }), clientRow({ id: "b", title: "Cours de maths" })])
    expect(html.match(/Avec achats/g)).toHaveLength(1)
  })

  const studentRow = (over) => ({
    id: "m1", title: "Courses du mois", type: "Livraison", city: "Cotonou", budget: 20000, net: 17600, urgent: false,
    deadline: "2026-10-30", applicationStatus: null, ...over,
  })
  const studentList = (missions) =>
    text(
      renderToStaticMarkup(
        <StudentExploreView
          result={{
            filters: { q: "", type: "", cities: [], urgency: "", budget: "", sort: "", page: 1 },
            hasFilter: false, total: missions.length, pageSize: 9,
            verification: { key: "verified", label: "Compte vérifié", canApply: true, action: null },
            missions,
          }}
        />,
      ),
    )

  it("côté étudiant : seulement pour la mission avec achats", () => {
    const html = studentList([studentRow({ id: "a", withPurchases: true }), studentRow({ id: "b", title: "Cours de maths" })])
    expect(html.match(/Avec achats/g)).toHaveLength(1)
  })
})
