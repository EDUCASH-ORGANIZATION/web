import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const refresh = vi.fn()
const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace, push: vi.fn() }) }))
vi.mock("@/lib/actions/admin-verifications.actions", () => ({
  approveStudentCard: vi.fn(),
  rejectStudentCard: vi.fn(),
  resetStudentRejection: vi.fn(),
  revokeStudentBadge: vi.fn(),
}))

const { ToastProvider } = await import("@/components/app-ui/toast")
const { VerificationsView } = await import("./verifications-view")
const { daysSinceExpiry, expiredTitle } = await import("./dossier-review")

const ID1 = "11111111-1111-4111-8111-111111111111"
const ID2 = "22222222-2222-4222-8222-222222222222"
const SIGNED = "https://storage.example/sign/cards/u1.jpg?token=SECRET"

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
  ...over,
})

const dossier = (over = {}) => ({
  userId: ID1,
  name: "Codjo Ahouansou",
  avatarUrl: null,
  school: "EPAC",
  level: "Licence 3",
  tab: "a-examiner",
  kind: "premiere",
  overdue48h: true,
  ageDays: 3,
  age: "3 j",
  today: "2026-10-15",
  submittedOn: "2026-10-12",
  submittedAt: "2026-10-12T09:12:00Z",
  createdAt: "2026-10-10T18:40:00Z",
  verifiedUntil: null,
  rejectionReason: null,
  hasCard: true,
  cardView: { kind: "image", url: SIGNED },
  actions: ["approve", "reject"],
  ...over,
})

const data = (over = {}) => ({
  now: "2026-10-15T10:00:00Z",
  today: "2026-10-15",
  onglet: "a-examiner",
  q: "",
  ecole: "",
  counts: { "a-examiner": 4, incomplets: 3, refuses: 1, verifies: 58, expires: 2 },
  oldestAgeDays: 3,
  rows: [row(), row({ userId: ID2, name: "Nadège Kpadonou", school: "ENEAM", overdue48h: true })],
  total: 4,
  page: 1,
  pageCount: 1,
  pageSize: 25,
  schools: ["ENEAM", "EPAC"],
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
const buttonLabels = (html) =>
  [...html.matchAll(/<button[^>]*class="btn [^"]*"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim())


const PRIVATE = { phone: "+22997000000", email: "prive@exemple.bj", signedUrl: "https://storage.example/sign/PRIV?token=ZZ", fcmToken: "fcm-secret" }
const TABS = [
  ["a-examiner", ["approve", "reject"], {}],
  ["incomplets", [], { hasCard: false, cardView: { kind: "none", url: null }, submittedAt: null }],
  ["refuses", ["reset"], { rejectionReason: "Photo floue ou illisible" }],
  ["verifies", ["revoke"], { verifiedUntil: "2027-03-12" }],
  ["expires", ["revoke"], { verifiedUntil: "2026-10-03" }],
]

describe("VerificationsView : 5 onglets, listes vides, erreur, page hors limites", () => {
  for (const [tab, actions, over] of TABS) {
    it(`onglet ${tab} : rendu sans exception, rien de privé dans la liste, URL signée seulement dans le dossier`, () => {
      const rows = [row({ tab, kind: null, verifiedUntil: over.verifiedUntil ?? null, ...PRIVATE })]
      const html = render({ data: data({ onglet: tab, rows, dossier: dossier({ tab, actions, ...over }) }) })
      const list = listHtml(html)
      expect(list.length).toBeGreaterThan(0)
      for (const v of Object.values(PRIVATE)) expect(html).not.toContain(v)
      expect(html).not.toMatch(/@exemple\.bj|\+229|undefined|\[object|NaN|null</)
      expect(list).not.toContain("token=")
      expect(html).not.toMatch(/[—–]/)
    })

    it(`onglet ${tab} : sans dossier ouvert, aucune URL signée ni donnée de dossier`, () => {
      const html = render({ data: data({ onglet: tab, rows: [row({ tab, kind: null, ...PRIVATE })], dossier: null }) })
      expect(html).not.toContain("token=")
      for (const v of Object.values(PRIVATE)) expect(html).not.toContain(v)
    })

    it(`onglet ${tab} : liste vide rend un état vide sans exception`, () => {
      const html = render({ data: data({ onglet: tab, rows: [], total: 0, dossier: null }) })
      expect(html).toContain("empty")
      expect(html).not.toMatch(/undefined|NaN|\[object/)
    })
  }

  it("page hors limites : rendu sans exception, état vide ou liste", () => {
    const html = render({ data: data({ rows: [], total: 4, page: 9, pageCount: 1 }) })
    expect(html).not.toMatch(/undefined|NaN|\[object/)
    expect(html).toContain("<h1")
  })

  it("erreur : alerte, aucune donnée, un seul h1", () => {
    const html = render({ data: null, error: "Impossible." })
    expect(html).toContain('role="alert"')
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).not.toContain("token=")
  })

  it("dossier introuvable : rendu sans exception", () => {
    const html = render({ data: data({ dossierNotFound: true }) })
    expect(html).not.toMatch(/undefined|NaN|\[object/)
  })

  it("bannière d'expiration dans le dossier : pluriels et cas limites rendus", () => {
    const at = (until, today = "2026-10-15") =>
      render({ data: data({ onglet: "expires", dossier: dossier({ tab: "expires", actions: ["revoke"], verifiedUntil: until, today }) }) })
    expect(at("2026-10-15")).toContain("Badge expiré aujourd&#x27;hui")
    expect(at("2026-10-14")).toContain("Badge expiré depuis 1 jour<")
    expect(at("2026-10-08")).toContain("Badge expiré depuis 7 jours")
    expect(at(null)).toContain('banner__title">Badge expiré<')
    expect(at("pas-une-date")).toContain('banner__title">Badge expiré<')
    expect(at("2026-10-20")).toContain("Badge expiré aujourd&#x27;hui")
  })
})

describe("jour d'expiration : cas limites", () => {
  it("horodatage complet, espaces, fin de mois et d'année", () => {
    expect(daysSinceExpiry("2026-10-03T00:00:00+00:00", "2026-10-15")).toBe(12)
    expect(daysSinceExpiry(" 2026-10-14 ", "2026-10-15")).toBe(1)
    expect(daysSinceExpiry("2025-12-31", "2026-01-01")).toBe(1)
    expect(daysSinceExpiry("2026-10-15", undefined)).toBeNull()
    expect(daysSinceExpiry(20261015, "2026-10-15")).toBeNull()
    expect(expiredTitle(undefined)).toBe("Badge expiré")
    expect(expiredTitle(2)).toBe("Badge expiré depuis 2 jours")
  })
})
