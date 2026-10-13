// QA indépendante RD-CLIENT-01 : layout client réel + action réelle + requireRole réel, seul Supabase est simulé.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { NextRequest } from "next/server"

const state = { user: null, profile: null, profileError: null, getUserThrows: false, profilesThrows: false, count: 3, countError: null }
const rendered = vi.fn()

vi.mock("next/navigation", () => ({
  redirect: (to) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT", to }) },
  unstable_rethrow: (e) => { if (e?.digest === "NEXT_REDIRECT") throw e },
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => { if (state.getUserThrows) throw new Error("net"); return { data: { user: state.user }, error: null } } },
    from: (table) => {
      if (table === "profiles") return { select: () => ({ eq: () => ({ maybeSingle: async () => {
        if (state.profilesThrows) throw new Error("db")
        return { data: state.profile, error: state.profileError } } }) }) }
      return { select: () => ({ eq: () => ({ eq: async () => ({ count: state.count, error: state.countError }) }) }) }
    },
  }),
}))
vi.mock("@/components/app-shell/app-shell", () => ({ AppShell: ({ children }) => <div data-shell>{children}</div> }))
vi.mock("@/components/client-space/shell/client-nav", () => ({ CLIENT_NAV: [] }))
vi.mock("@/components/app-ui/toast", () => ({ ToastProvider: ({ children }) => <>{children}</> }))
vi.mock("@/components/app-ui/offline-banner", () => ({ OfflineBanner: () => null }))
vi.mock("@/components/shared/pwa-install-banner-loader", () => ({ PwaInstallBannerLoader: () => null }))

import ClientLayout from "@/app/(client)/layout"

function Child() { rendered(); return <p>secret</p> }

beforeEach(() => {
  Object.assign(state, { user: { id: "u1", user_metadata: { role: "client" } }, profile: { role: "client", full_name: "Ro", city: "X", is_suspended: false }, profileError: null, getUserThrows: false, profilesThrows: false, count: 3, countError: null })
  rendered.mockClear()
})

async function run() {
  try {
    const el = await ClientLayout({ children: <Child /> })
    const html = renderToStaticMarkup(el)
    return { html }
  } catch (e) { return { to: e.to, err: e } }
}

describe("matrice d'autorisation du layout client (réel de bout en bout)", () => {
  const cases = [
    ["sans session", () => { state.user = null }, "/auth/login"],
    ["étudiant (metadata client)", () => { state.profile.role = "student" }, "/dashboard"],
    ["admin", () => { state.profile.role = "admin" }, "/admin/dashboard"],
    ["client suspendu", () => { state.profile.is_suspended = true }, "/auth/login?suspended=1"],
    ["suspendu non-client", () => { state.profile.role = "student"; state.profile.is_suspended = true }, "/auth/login?suspended=1"],
    ["profil introuvable", () => { state.profile = null }, "/"],
    ["lecture profil en erreur", () => { state.profile = null; state.profileError = { message: "x" } }, "/"],
    ["rôle invalide", () => { state.profile.role = "root" }, "/"],
    ["profil sans rôle", () => { state.profile.role = null }, "/"],
  ]
  it.each(cases)("%s : redirection, jamais de rendu", async (_n, setup, to) => {
    setup()
    const r = await run()
    expect(r.html).toBeUndefined()
    expect(r.to).toBe(to)
    expect(rendered).not.toHaveBeenCalled()
  })

  it("getUser lève : jamais de rendu des enfants", async () => {
    state.getUserThrows = true
    const r = await run()
    expect(r.html).toBeUndefined()
    expect(rendered).not.toHaveBeenCalled()
  })
  it("lecture profiles lève : jamais de rendu", async () => {
    state.profilesThrows = true
    const r = await run()
    expect(r.html).toBeUndefined()
    expect(rendered).not.toHaveBeenCalled()
  })
  it("client actif : rend les enfants", async () => {
    const r = await run()
    expect(r.html).toContain("secret")
  })
  it("client actif, compteur en erreur : rend quand même", async () => {
    state.countError = { message: "x" }
    const r = await run()
    expect(r.html).toContain("secret")
  })
  it("is_suspended truthy non booleen (\"true\") ne passe pas pour suspendu mais ne casse rien", async () => {
    state.profile.is_suspended = null
    const r = await run()
    expect(r.html).toContain("secret")
  })
})

describe("réponse action vide / redirectTo externe (layout réel, action simulée)", () => {
  it("redirectTo externe -> accueil", async () => {
    vi.resetModules()
    vi.doMock("@/lib/actions/client-shell.actions", () => ({ getClientShellData: async () => ({ error: "e", redirectTo: "https://evil.com" }) }))
    const { default: L } = await import("@/app/(client)/layout")
    await expect(L({ children: <Child /> })).rejects.toMatchObject({ to: "/" })
    vi.doUnmock("@/lib/actions/client-shell.actions")
    expect(rendered).not.toHaveBeenCalled()
  })
})
