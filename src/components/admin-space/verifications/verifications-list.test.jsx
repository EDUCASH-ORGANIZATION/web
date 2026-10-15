import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/admin-verifications.actions", () => ({
  approveStudentCard: vi.fn(),
  rejectStudentCard: vi.fn(),
  resetStudentRejection: vi.fn(),
  revokeStudentBadge: vi.fn(),
}))

const { ToastProvider } = await import("@/components/app-ui/toast")
const { VerificationsView } = await import("./verifications-view")
const { QueueList, rowSubtitle, submittedLabel } = await import("./queue-list")

const ID1 = "11111111-1111-4111-8111-111111111111"
const ID2 = "22222222-2222-4222-8222-222222222222"
const ID3 = "33333333-3333-4333-8333-333333333333"

const row = (over = {}) => ({
  userId: ID1,
  name: "Codjo Ahouansou",
  avatarUrl: null,
  school: "EPAC",
  level: "Licence 3",
  tab: "a-examiner",
  kind: "premiere",
  overdue48h: false,
  age: "Hier",
  submittedOn: "2026-10-14",
  ...over,
})

const data = (over = {}) => ({
  now: "2026-10-15T10:00:00Z",
  today: "2026-10-15",
  onglet: "a-examiner",
  q: "",
  ecole: "",
  delai: "",
  counts: { "a-examiner": 3, incomplets: 0, refuses: 1, verifies: 5, expires: 2 },
  oldestAgeDays: 10,
  rows: [
    row({ userId: ID1, overdue48h: true, age: "10 j", submittedOn: "2026-10-05" }),
    row({ userId: ID2, name: "Nadège Kpadonou", age: "Hier", submittedOn: "2026-10-14" }),
    row({ userId: ID3, name: "Awa Sossou", age: "Aujourd'hui", submittedOn: "2026-10-15" }),
  ],
  total: 3,
  page: 1,
  pageCount: 1,
  pageSize: 25,
  schools: ["EPAC"],
  dossier: null,
  dossierNotFound: false,
  ...over,
})

const render = (props) =>
  renderToStaticMarkup(
    <ToastProvider>
      <VerificationsView {...props} />
    </ToastProvider>,
  )
const listHtml = (html) => html.match(/<nav aria-label="Dossiers à traiter"[\s\S]*?<\/nav>/)?.[0] ?? ""

describe("liste façon planche v1", () => {
  const html = render({ data: data() })
  const list = listHtml(html)

  it("filtre Délai et mention de tri sur À examiner seulement", () => {
    expect(html).toContain('name="delai"')
    expect(html).toContain("Plus anciens d&#x27;abord")
    const other = render({ data: data({ onglet: "refuses", rows: [row({ tab: "refuses", kind: null })] }) })
    expect(other).not.toContain('name="delai"')
  })

  it("en-tête de liste : ordre et plage", () => {
    expect(html).toContain("Plus ancien en premier")
    expect(html).toContain("1 à 3 sur 3")
    const page2 = render({ data: data({ page: 2, pageCount: 2, total: 28, rows: [row()] }) })
    expect(page2).toContain("26 à 26 sur 28")
  })

  it("pastilles : erreur avec +48 h, contour pour Hier et Auj.", () => {
    expect(list).toMatch(/badge badge--erreur badge--sm">10 j · \+48 h</)
    expect(list).toMatch(/badge badge--contour badge--sm">Hier</)
    expect(list).toMatch(/badge badge--contour badge--sm">Auj\.</)
    expect(list).not.toContain("Renvoi")
  })

  it("sous-titres : soumis le, hier, aujourd'hui", () => {
    expect(list).toContain("EPAC · soumis le 5 oct.")
    expect(list).toContain("EPAC · soumis hier")
    expect(list).toContain("EPAC · soumis aujourd&#x27;hui")
  })

  it("aucune URL signée ni e-mail", () => {
    expect(list).not.toContain("token=")
    expect(list).not.toContain("@")
  })
})

describe("délai conservé dans les liens", () => {
  it("lignes et pagination", () => {
    const html = render({ data: data({ delai: "plus-48h", page: 1, pageCount: 2 }) })
    expect(listHtml(html)).toContain(`href="/admin/verifications?id=${ID1}&amp;delai=plus-48h"`)
    expect(html).toContain('href="/admin/verifications?delai=plus-48h&amp;page=2"')
  })

  it("résultat vide avec un délai : message de recherche", () => {
    const html = render({ data: data({ delai: "plus-48h", rows: [], total: 0 }) })
    expect(html).toContain("ne correspond à cette recherche")
  })
})

describe("aides de la liste", () => {
  it("submittedLabel", () => {
    expect(submittedLabel("2026-10-05", "2026-10-15")).toBe("soumis le 5 oct.")
    expect(submittedLabel("2026-10-14", "2026-10-15")).toBe("soumis hier")
    expect(submittedLabel("2026-10-15", "2026-10-15")).toBe("soumis aujourd'hui")
    expect(submittedLabel(null, "2026-10-15")).toBe("")
    expect(submittedLabel("n'importe quoi", "2026-10-15")).toBe("")
  })

  it("rowSubtitle : renouvellement et repli sans jour", () => {
    expect(rowSubtitle(row({ kind: "renouvellement" }), "2026-10-15")).toBe("EPAC · renouvellement du badge")
    expect(rowSubtitle(row({ submittedOn: null }), "2026-10-15")).toBe("EPAC · première demande")
    expect(rowSubtitle(row({ tab: "refuses", kind: null }), "2026-10-15")).toBe("EPAC · Carte refusée")
  })

  it("QueueList sans délai : lien inchangé", () => {
    const html = renderToStaticMarkup(<QueueList rows={[row()]} openId={ID1} onglet="a-examiner" q="" ecole="" page={1} today="2026-10-15" />)
    expect(html).toContain(`href="/admin/verifications?id=${ID1}"`)
    expect(html).toMatch(/aria-current="true"/)
  })
})
