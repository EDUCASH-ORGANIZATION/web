// Layout admin : garde par getAdminShellData (redirections fail-closed, suspendu et faux admin refusés),
// coquille AppShell unique : une seule barre mobile, aucun abonnement temps réel, compteur « À examiner » transmis.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import path from "node:path"

const state = { user: null, profile: null, pending: 0 }
const redirect = vi.fn((to) => {
  throw new Error(`REDIRECT:${to}`)
})
const subscriptions = vi.fn()
const createServiceClient = vi.fn(() => makeService())

function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: state.profile, error: null }),
      }
      return chain
    },
  }
}

// Client service : `state.pending` étudiants avec carte, tous « à examiner » (jamais vérifiés, sans motif).
function makeService() {
  return {
    from: (table) => {
      const b = {
        select: () => b,
        not: () => b,
        in: () => b,
        eq: () => b,
        is: () => b,
        gte: () => b,
        order: () => b,
        range: () => b,
        then: (res, rej) => {
          const rows = Array.from({ length: state.pending }, (_, i) =>
            table === "student_profiles" ? { user_id: `s${i}` } : { user_id: `s${i}`, verified_until: null },
          )
          return Promise.resolve({ data: rows, error: null }).then(res, rej)
        },
      }
      return b
    },
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to) => redirect(to),
  unstable_rethrow: (err) => {
    throw err
  },
  usePathname: () => "/admin/dashboard",
}))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeSupabase() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
vi.mock("@/hooks/use-unread-count", () => ({
  useUnreadCount: (...args) => {
    subscriptions(...args)
    return args[1]
  },
}))
vi.mock("@/lib/actions/auth.actions", () => ({ logout: async () => {} }))

import AdminLayout from "./layout"

const ADMIN = { role: "admin", full_name: "Awa Admin", city: "Cotonou", is_suspended: false }
const forged = { id: "u1", user_metadata: { role: "admin" } }

beforeEach(() => {
  redirect.mockClear()
  subscriptions.mockClear()
  createServiceClient.mockClear()
  state.user = forged
  state.profile = { ...ADMIN }
  state.pending = 0
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("(admin)/layout", () => {
  it("redirige un profil student qui porte un metadata admin vers son tableau de bord, sans service role", async () => {
    state.profile = { ...ADMIN, role: "student" }
    await expect(AdminLayout({ children: <p>contenu secret</p> })).rejects.toThrow("REDIRECT:/dashboard")
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("redirige un client vers son tableau de bord", async () => {
    state.profile = { ...ADMIN, role: "client" }
    await expect(AdminLayout({ children: null })).rejects.toThrow("REDIRECT:/client/dashboard")
  })

  it("redirige un visiteur non connecté vers la connexion", async () => {
    state.user = null
    await expect(AdminLayout({ children: null })).rejects.toThrow("REDIRECT:/auth/login")
  })

  it("administrateur suspendu : jamais les enfants, redirigé vers la connexion signalée", async () => {
    state.profile = { ...ADMIN, is_suspended: true }
    await expect(AdminLayout({ children: <p>contenu secret</p> })).rejects.toThrow("REDIRECT:/auth/login?suspended=1")
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("profil introuvable : retour à l'accueil", async () => {
    state.profile = null
    await expect(AdminLayout({ children: null })).rejects.toThrow(/^REDIRECT:\/$/)
  })

  it("laisse passer un profil admin", async () => {
    const html = renderToStaticMarkup(await AdminLayout({ children: <p>contenu</p> }))
    expect(redirect).not.toHaveBeenCalled()
    expect(html).toContain("contenu")
  })

  it("admin : racine ds a2, une seule barre mobile à 4 entrées plus Plus, une seule navigation latérale", async () => {
    state.pending = 7
    const html = renderToStaticMarkup(await AdminLayout({ children: <p>contenu</p> }))
    expect(html).toContain('class="ds a2"')
    expect(html.match(/<nav[^>]*aria-label="Navigation mobile"/g)).toHaveLength(1)
    expect(html.match(/<aside/g)).toHaveLength(1)
    expect(html.match(/<main/g)).toHaveLength(1)
    expect(html.match(/<nav[^>]*aria-label="Navigation principale"/g)).toHaveLength(1)
    const start = html.indexOf('<nav class="bottom-nav')
    const nav = html.slice(start, html.indexOf("</nav>", start))
    expect(nav).toContain("Accueil")
    expect(nav).toContain("Vérifs")
    expect(nav).toContain("Missions")
    expect(nav).toContain("Utilisateurs")
    expect(nav).toContain("Plus")
    expect(nav).toContain('aria-current="page"')
    expect(html).toContain("Administration")
  })

  it("transmet le nombre « À examiner » à la barre latérale et à la barre mobile", async () => {
    state.pending = 7
    const html = renderToStaticMarkup(await AdminLayout({ children: null }))
    expect(html.match(/Vérifications, 7 à examiner/g)).toHaveLength(1)
    expect(html).toContain("Vérifs, 7 à examiner")
  })

  it("aucun abonnement temps réel aux messages dans l'espace admin", async () => {
    renderToStaticMarkup(await AdminLayout({ children: <p>contenu</p> }))
    expect(subscriptions).not.toHaveBeenCalled()
    const source = readFileSync(path.join(process.cwd(), "src/app/(admin)/admin/layout.js"), "utf8")
    expect(source.match(/<AppShell/g)).toHaveLength(1)
    expect(source).not.toMatch(/UnreadProvider|useUnreadCount|admin-sidebar|BottomNav|createServiceClient|requireRole/)
  })

  it("une réponse sans coquille ne rend jamais les enfants", async () => {
    state.user = null
    await expect(AdminLayout({ children: <p>contenu secret</p> })).rejects.toThrow("REDIRECT:")
  })
})
