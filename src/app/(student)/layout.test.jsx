// Layout étudiant : garde par getStudentShellData (redirections fail-closed, suspendu refusé),
// coquille AppShell unique : une seule barre mobile, un seul abonnement temps réel.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import path from "node:path"

const state = { user: null, role: "student", suspended: false, unread: 3 }
const redirect = vi.fn((to) => {
  throw new Error(`REDIRECT:${to}`)
})
const subscriptions = vi.fn()

// Le compteur de non lus lit les missions liées (candidature) puis les messages de leurs clients : `state.unread`
// messages non lus d'un client lié sur une mission où l'étudiant a postulé.
const LINKED = {
  applications: [{ mission_id: "m1" }],
  missions: [{ id: "m1", client_id: "c1" }],
}

function makeSupabase() {
  const from = (table) => {
    const rows = () =>
      table === "messages" ? Array.from({ length: state.unread }, () => ({ sender_id: "c1", mission_id: "m1" })) : (LINKED[table] ?? [])
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({
        data: state.role
          ? { role: state.role, full_name: "Awa Dossou", city: "Cotonou", is_suspended: state.suspended }
          : null,
        error: null,
      }),
      then: (resolve) => resolve({ data: rows(), error: null }),
    }
    return chain
  }
  return { auth: { getUser: async () => ({ data: { user: state.user }, error: null }) }, from }
}

vi.mock("next/navigation", () => ({
  redirect: (to) => redirect(to),
  unstable_rethrow: (err) => {
    throw err
  },
  usePathname: () => "/dashboard",
}))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeSupabase() }))
vi.mock("@/hooks/use-unread-count", () => ({
  useUnreadCount: (...args) => {
    subscriptions(...args)
    return args[1]
  },
}))
vi.mock("@/lib/actions/auth.actions", () => ({ logout: async () => {} }))
vi.mock("@/components/shared/pwa-install-banner-loader", () => ({ PwaInstallBannerLoader: () => null }))

import StudentLayout from "./layout"

beforeEach(() => {
  redirect.mockClear()
  subscriptions.mockClear()
  state.user = { id: "u1" }
  state.role = "student"
  state.suspended = false
  state.unread = 3
})

describe("(student)/layout", () => {
  it("visiteur non connecté : redirige vers la connexion", async () => {
    state.user = null
    await expect(StudentLayout({ children: null })).rejects.toThrow("REDIRECT:/auth/login")
  })

  it("rôle introuvable : retour à l'accueil", async () => {
    state.role = null
    await expect(StudentLayout({ children: null })).rejects.toThrow(/^REDIRECT:\/$/)
  })

  it.each([
    ["client", "/client/dashboard"],
    ["admin", "/admin/dashboard"],
  ])("rôle %s : redirige vers son tableau de bord", async (role, to) => {
    state.role = role
    await expect(StudentLayout({ children: null })).rejects.toThrow(`REDIRECT:${to}`)
  })

  it("étudiant suspendu : jamais les enfants, redirigé vers la connexion signalée", async () => {
    state.suspended = true
    const render = StudentLayout({ children: <p>contenu secret</p> })
    await expect(render).rejects.toThrow("REDIRECT:/auth/login?suspended=1")
  })

  it("étudiant : racine ds e2, une seule barre mobile à 5 entrées, une seule navigation latérale", async () => {
    const html = renderToStaticMarkup(await StudentLayout({ children: <p>contenu</p> }))
    expect(html).toContain('class="ds e2"')
    expect(html.match(/<nav[^>]*aria-label="Navigation mobile"/g)).toHaveLength(1)
    expect(html.match(/<aside/g)).toHaveLength(1)
    expect(html.match(/<main/g)).toHaveLength(1)
    expect(html.match(/<nav[^>]*aria-label="Navigation principale"/g)).toHaveLength(1)
    const nav = html.slice(html.indexOf('<nav class="bottom-nav'), html.indexOf("</nav>", html.indexOf('<nav class="bottom-nav')))
    expect(nav.match(/<a [^>]*class="bnav-item/g)).toHaveLength(5)
    expect(nav).toContain('aria-current="page"')
    expect(nav).toContain("Messages, 3 non lus")
    expect(html).toContain("Espace étudiant")
    expect(html).toContain("contenu")
  })

  it("un seul abonnement temps réel aux non lus (un seul UnreadProvider, aucun hook hors provider)", async () => {
    renderToStaticMarkup(await StudentLayout({ children: <p>contenu</p> }))
    expect(subscriptions).toHaveBeenCalledTimes(1)
    expect(subscriptions).toHaveBeenCalledWith("u1", 3)
    const source = readFileSync(path.join(process.cwd(), "src/app/(student)/layout.js"), "utf8")
    expect(source.match(/<AppShell/g)).toHaveLength(1)
    expect(source).not.toMatch(/UnreadProvider|useUnreadCount|shared\/sidebar|shared\/student-header|BottomNav/)
  })

  it("une réponse sans coquille ne rend jamais les enfants", async () => {
    state.user = null
    await expect(StudentLayout({ children: <p>contenu secret</p> })).rejects.toThrow("REDIRECT:")
  })
})
