// Layout étudiant : redirections de rôle inchangées, barre mobile commune, aucune réserve Tailwind sur main.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = { user: null, role: "student" }
const redirect = vi.fn((to) => {
  throw new Error(`REDIRECT:${to}`)
})

function makeSupabase() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => ({ data: { full_name: "Awa", balance: 0, reserved: 0 } }),
    maybeSingle: async () => ({ data: { school: "UAC" } }),
    then: (resolve) => resolve({ data: null, count: 3 }),
  }
  return { auth: { getUser: async () => ({ data: { user: state.user } }) }, from: () => chain }
}

vi.mock("next/navigation", () => ({ redirect: (to) => redirect(to), usePathname: () => "/dashboard" }))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeSupabase() }))
vi.mock("@/lib/auth/server-role", () => ({ getServerRole: async () => ({ role: state.role }) }))
vi.mock("@/hooks/use-unread-count", () => ({ useUnreadCount: (_id, initial) => initial }))
vi.mock("@/components/shared/sidebar", () => ({ Sidebar: () => null }))
vi.mock("@/components/shared/student-header", () => ({ StudentHeader: () => null }))
vi.mock("@/components/shared/pwa-install-banner-loader", () => ({ PwaInstallBannerLoader: () => null }))

import StudentLayout from "./layout"

beforeEach(() => {
  redirect.mockClear()
  state.user = { id: "u1" }
  state.role = "student"
})

describe("(student)/layout", () => {
  it("visiteur non connecté : redirige vers la connexion", async () => {
    state.user = null
    await expect(StudentLayout({ children: null })).rejects.toThrow("REDIRECT:/auth/login")
  })

  it("rôle introuvable : retour à l'accueil", async () => {
    state.role = null
    await expect(StudentLayout({ children: null })).rejects.toThrow("REDIRECT:/")
  })

  it.each([
    ["client", "/client/dashboard"],
    ["admin", "/admin/dashboard"],
  ])("rôle %s : redirige vers son tableau de bord", async (role, to) => {
    state.role = role
    await expect(StudentLayout({ children: null })).rejects.toThrow(`REDIRECT:${to}`)
  })

  it("étudiant : une seule barre mobile à 4 entrées, espaceur présent, main sans pb-20", async () => {
    const html = renderToStaticMarkup(await StudentLayout({ children: <p>contenu</p> }))
    expect(html.match(/<nav[^>]*aria-label="Navigation mobile"/g)).toHaveLength(1)
    const nav = html.slice(html.indexOf('<nav class="bottom-nav'), html.indexOf("</nav>"))
    expect(nav.match(/<a [^>]*class="bnav-item/g)).toHaveLength(4)
    expect(nav).toContain('aria-current="page"')
    expect(nav).toContain("Messages, 3 non lus")
    expect(html).toContain('class="bnav2-spacer"')
    const main = html.match(/<main[^>]*>/)[0]
    expect(main).not.toContain("pb-20")
    expect(html.indexOf("contenu")).toBeLessThan(html.indexOf("bnav2-spacer"))
  })
})
