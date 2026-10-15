import { describe, expect, it, vi } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
const nav = { pathname: "/messages", search: "" }
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const { StudentInboxView } = await import("./inbox-view")

const NOW = "2026-10-13T12:00:00Z"
const M1 = "11111111-1111-4111-8111-111111111111"
const M2 = "11111111-1111-4111-8111-111111111112"
const conv = (over) => ({
  key: `${M1}:c1`, missionId: M1, name: "Marc D.", avatarUrl: null, missionTitle: "Cours de maths",
  state: "candidate", preview: "Bonjour", lastAt: "2026-10-13T09:48:00Z", unreadCount: 0, ...over,
})
const LIST = [
  conv({ unreadCount: 1 }),
  conv({ key: `${M2}:c1`, missionId: M2, name: "Rosine H.", missionTitle: "Traduction", state: "in_progress" }),
]
const render = (conversations, { pathname = "/messages", search = "" } = {}) => {
  nav.pathname = pathname
  nav.search = search
  return renderToStaticMarkup(<StudentInboxView now={NOW} result={{ conversations }} />)
}
const count = (html, s) => html.split(s).length - 1

describe("liste messagerie : filtres et recherche", () => {
  it("ignore un filtre inconnu", () => {
    const html = render(LIST, { search: "filtre=zzz" })
    expect(html).toContain("Marc D.")
    expect(html).toContain("Rosine H.")
    expect(html).not.toContain('name="filtre"')
    expect(html).not.toContain("filtre=zzz")
  })

  it("combine en-cours et q", () => {
    const html = render(LIST, { search: "filtre=en-cours&q=Rosine" })
    expect(html).toContain("Rosine H.")
    expect(html).not.toContain("Marc D.")
    expect(html).toContain('value="en-cours"')
    expect(html).toContain("/messages/" + M2 + "?q=Rosine&amp;filtre=en-cours")
  })

  it("échappe les caractères spéciaux de q partout", () => {
    const q = `%<"&x`
    const html = render(LIST, { search: "q=" + encodeURIComponent(q) })
    expect(html).not.toContain("<\"")
    expect(html).not.toMatch(/<[^>]*[^&]<"/)
    expect(html).not.toContain(`value="%<"`)
    expect(html).toContain("q=%25%3C%22%26x")
    expect(html).toContain("&lt;")
    // liens de pastille conservent q encodé
    expect(html).toContain('href="/messages?q=%25%3C%22%26x&amp;filtre=non-lues"')
    expect(html).toContain('action="/messages"')
  })

  it("garde la conversation ouverte dans les liens de pastille et l'action", () => {
    const html = render(LIST, { pathname: `/messages/${M1}`, search: "q=Marc" })
    expect(html).toContain(`action="/messages/${M1}"`)
    expect(html).toContain(`href="/messages/${M1}?q=Marc&amp;filtre=non-lues"`)
    expect(html).toContain(`href="/messages/${M1}?q=Marc&amp;filtre=en-cours"`)
    expect(html).toContain('aria-current="true"')
    expect(count(html, 'aria-current="true"')).toBe(1)
  })

  it("vue vide En cours, vouvoyée", () => {
    const html = render([conv()], { search: "filtre=en-cours" })
    expect(html).toContain("Aucune conversation en cours")
    expect(html).toContain("Les échanges des missions en cours apparaîtront ici.")
    expect(html).not.toMatch(/\b(tu|ton|ta|tes)\b/i)
  })

  it("étudiant sans conversation : pas de liste, pas de crash", () => {
    const html = render([])
    expect(html).toContain("Pas encore de message")
    expect(html).not.toContain("e2-06-convo")
  })
})

describe("segment messages", () => {
  const dir = join(process.cwd(), "src/app/(student)/messages")
  it("layout sans Suspense, sans loading.js", () => {
    const src = readFileSync(join(dir, "layout.js"), "utf8")
    expect(src).not.toMatch(/<Suspense|from "react"/)
    expect(existsSync(join(dir, "loading.js"))).toBe(false)
    expect(existsSync(join(dir, "[missionId]", "loading.js"))).toBe(false)
    expect(src.indexOf("getStudentConversations")).toBeGreaterThan(-1)
  })
})
