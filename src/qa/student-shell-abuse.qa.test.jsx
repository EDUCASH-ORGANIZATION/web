// QA indépendante RD-STUDENT-01 vague 1 : layout étudiant réel + action réelle + requireRole réel + AppShell réel.
// Seuls Supabase, la navigation Next et le hook d'abonnement (espionné) sont simulés.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = { user: null, profile: null, profileError: null, getUserThrows: false, count: 4, countError: null }
const reads = []
const rendered = vi.fn()
const unreadHook = vi.fn()

vi.mock("next/navigation", () => ({
  redirect: (to) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT", to }) },
  unstable_rethrow: (e) => { if (e?.digest === "NEXT_REDIRECT") throw e },
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push() {}, replace() {}, prefetch() {} }),
}))
vi.mock("@/lib/actions/auth.actions", () => ({ logout: vi.fn() }))
vi.mock("@/hooks/use-unread-count", () => ({ useUnreadCount: (...a) => { unreadHook(...a); return a[1] } }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => { if (state.getUserThrows) throw new Error("net"); return { data: { user: state.user }, error: null } } },
    from: (table) => {
      reads.push(table)
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.profile, error: state.profileError }) }) }) }
      }
      if (table === "applications" || table === "missions" || table === "messages") {
        // Candidature à m1 (client c1) ; `state.count` messages non lus de c1 sur m1.
        const data = {
          applications: [{ mission_id: "m1" }],
          missions: [{ id: "m1", client_id: "c1" }],
          messages: Array.from({ length: state.count }, () => ({ sender_id: "c1", mission_id: "m1" })),
        }[table]
        const chain = { select: () => chain, eq: () => chain, in: () => chain, limit: () => chain, then: (ok, ko) => Promise.resolve({ data, error: state.countError }).then(ok, ko) }
        return chain
      }
      throw new Error(`table inattendue : ${table}`)
    },
  }),
}))
vi.mock("@/components/shared/pwa-install-banner-loader", () => ({ PwaInstallBannerLoader: () => null }))

import StudentLayout from "@/app/(student)/layout"
import { getStudentShellData } from "@/lib/actions/student-shell.actions"

function Child() { rendered(); return <p>contenu-secret</p> }

beforeEach(() => {
  Object.assign(state, {
    user: { id: "u1", user_metadata: { role: "student" } },
    profile: { role: "student", full_name: "Sèna Agossou", city: "Cotonou", is_suspended: false },
    profileError: null, getUserThrows: false, count: 4, countError: null,
  })
  reads.length = 0
  rendered.mockClear()
  unreadHook.mockClear()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

async function run() {
  try {
    const el = await StudentLayout({ children: <Child /> })
    return { html: renderToStaticMarkup(el) }
  } catch (e) { return { to: e.to, err: e } }
}

describe("matrice d'autorisation du layout étudiant", () => {
  const cases = [
    ["sans session", () => { state.user = null }, "/auth/login"],
    ["client (user_metadata étudiant forgé)", () => { state.profile.role = "client"; state.user.user_metadata.role = "student" }, "/client/dashboard"],
    ["admin (user_metadata étudiant forgé)", () => { state.profile.role = "admin" }, "/admin/dashboard"],
    ["étudiant suspendu", () => { state.profile.is_suspended = true }, "/auth/login?suspended=1"],
    ["client suspendu", () => { state.profile.role = "client"; state.profile.is_suspended = true }, "/auth/login?suspended=1"],
    ["profil introuvable malgré user_metadata étudiant", () => { state.profile = null }, "/"],
    ["profil illisible (erreur)", () => { state.profile = null; state.profileError = { message: "x" } }, "/"],
    ["rôle invalide", () => { state.profile.role = "root" }, "/"],
    ["rôle absent", () => { state.profile.role = null }, "/"],
  ]
  it.each(cases)("%s : redirection, aucun enfant, aucune lecture de messages", async (_n, setup, to) => {
    setup()
    const r = await run()
    expect(r.html).toBeUndefined()
    expect(r.to).toBe(to)
    expect(rendered).not.toHaveBeenCalled()
    expect(reads).not.toContain("messages")
    expect(unreadHook).not.toHaveBeenCalled()
  })

  it("getUser lève : jamais de rendu des enfants", async () => {
    state.getUserThrows = true
    const r = await run()
    expect(r.html).toBeUndefined()
    expect(rendered).not.toHaveBeenCalled()
  })

  it("étudiant actif : rend les enfants et ne lit que profiles, candidatures, missions et messages", async () => {
    const r = await run()
    expect(r.html).toContain("contenu-secret")
    expect(new Set(reads)).toEqual(new Set(["profiles", "applications", "missions", "messages"]))
  })

  it("compteur de messages en erreur : la coquille s'affiche quand même, pastille à 0", async () => {
    state.countError = { message: "x" }
    const r = await run()
    expect(r.html).toContain("contenu-secret")
    expect(unreadHook).toHaveBeenCalledWith("u1", 0)
  })

  it("is_suspended null (colonne non renseignée) ne bloque pas un étudiant", async () => {
    state.profile.is_suspended = null
    expect((await run()).html).toContain("contenu-secret")
  })
})

describe("un seul abonnement, une seule navigation", () => {
  it("useUnreadCount n'est appelé qu'une fois par rendu de page", async () => {
    await run()
    expect(unreadHook).toHaveBeenCalledTimes(1)
    expect(unreadHook).toHaveBeenCalledWith("u1", 4)
  })

  it("le HTML contient un seul <aside>, une seule barre du haut, un seul <main id=contenu> et une seule barre mobile", async () => {
    const { html } = await run()
    expect(html.match(/<aside\b/g)).toHaveLength(1)
    expect(html.match(/<main\b/g)).toHaveLength(1)
    expect(html.match(/id="contenu"/g)).toHaveLength(1)
    expect(html.match(/class="[^"]*\bbottom-nav--v2\b/g) ?? []).toHaveLength(1)
    expect(html.match(/<h1\b/g) ?? []).toHaveLength(0)
    expect(html).toMatch(/class="ds e2"/)
  })

  it("aucune donnée sensible dans le HTML de la coquille (pas de téléphone, de carte, d'id de rôle forgé)", async () => {
    const { html } = await run()
    expect(html).not.toMatch(/phone|card_url|rejection|user_metadata|service_role/i)
  })

  it("seul le prénom/nom d'affichage sort de l'action", async () => {
    const res = await getStudentShellData()
    expect(Object.keys(res.shell).sort()).toEqual(["fullName", "unreadCount", "userId"])
  })

  it("full_name non texte : chaîne vide, pas d'exception", async () => {
    state.profile.full_name = { toString() { return "x" } }
    const res = await getStudentShellData()
    expect(res.shell.fullName).toBe("")
  })

  it("count négatif ou null : 0 et pas de NaN", async () => {
    state.count = null
    expect((await getStudentShellData()).shell.unreadCount).toBe(0)
  })
})

describe("réponse action vide / redirectTo externe (layout réel, action simulée)", () => {
  it.each([["https://evil.com"], ["//evil.com"], ["javascript:alert(1)"], [undefined]])("redirectTo %s -> accueil", async (target) => {
    vi.resetModules()
    vi.doMock("@/lib/actions/student-shell.actions", () => ({ getStudentShellData: async () => ({ error: "e", redirectTo: target }) }))
    const { default: L } = await import("@/app/(student)/layout")
    await expect(L({ children: <Child /> })).rejects.toMatchObject({ to: "/" })
    vi.doUnmock("@/lib/actions/student-shell.actions")
    expect(rendered).not.toHaveBeenCalled()
  })

  it("réponse null ou {} : accueil, jamais de rendu", async () => {
    for (const reply of [null, undefined, {}, { shell: null }]) {
      vi.resetModules()
      vi.doMock("@/lib/actions/student-shell.actions", () => ({ getStudentShellData: async () => reply }))
      const { default: L } = await import("@/app/(student)/layout")
      await expect(L({ children: <Child /> })).rejects.toMatchObject({ to: "/" })
    }
    vi.doUnmock("@/lib/actions/student-shell.actions")
    expect(rendered).not.toHaveBeenCalled()
  })
})
