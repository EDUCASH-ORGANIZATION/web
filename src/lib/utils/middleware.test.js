import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const getUser = vi.fn()
const maybeSingle = vi.fn()
const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }))

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser }, from }),
}))

import { middleware } from "../../../middleware.js"

// `role` = profiles.role ; `metaRole` = user_metadata.role (par défaut identique, jamais l'autorité).
function asUser(role, metaRole = role) {
  getUser.mockResolvedValue({
    data: { user: role || metaRole ? { id: "u1", user_metadata: { role: metaRole } } : null },
  })
  maybeSingle.mockResolvedValue({ data: role ? { role, full_name: "A", city: "B", is_suspended: false } : null, error: null })
}

function asSuspended(role) {
  getUser.mockResolvedValue({ data: { user: { id: "u1", user_metadata: { role } } } })
  maybeSingle.mockResolvedValue({ data: { role, full_name: "A", city: "B", is_suspended: true }, error: null })
}

async function run(path) {
  const res = await middleware(new NextRequest(`http://localhost${path}`))
  const location = res.headers.get("location")
  return { status: res.status, location: location ? new URL(location) : null }
}

function expectLoginRedirect(res, next) {
  expect(res.location?.pathname).toBe("/auth/login")
  expect(res.location?.searchParams.get("next")).toBe(next)
}

beforeEach(() => {
  getUser.mockReset()
  maybeSingle.mockReset()
  from.mockClear()
})

describe("middleware - /clients", () => {
  it.each([null, "student", "client", "admin"])(
    "redirige en 308 vers l'accueil pour le rôle %s sans appeler Supabase",
    async (role) => {
      asUser(role)
      const res = await run("/clients")
      expect(res.status).toBe(308)
      expect(res.location?.pathname).toBe("/")
      expect(res.location?.search).toBe("")
      expect(getUser).not.toHaveBeenCalled()
    }
  )

  it("conserve la requête", async () => {
    asUser(null)
    const res = await run("/clients?utm_source=wa&x=y")
    expect(res.status).toBe(308)
    expect(res.location?.pathname).toBe("/")
    expect(res.location?.search).toBe("?utm_source=wa&x=y")
  })

  it("n'affecte ni /client ni /clients/x", async () => {
    asUser("client")
    expect((await run("/client")).location).toBeNull()
    expect((await run("/clients/x")).location).toBeNull()
  })
})

describe("middleware - visiteur", () => {
  beforeEach(() => asUser(null))

  it.each(["/talents/x", "/students/x", "/missions", "/"])(
    "laisse passer %s",
    async (path) => {
      const res = await run(path)
      expect(res.location).toBeNull()
    }
  )

  it.each([
    "/client/dashboard",
    "/client",
    "/student/missions/x",
    "/student",
    "/dashboard",
    "/applications/x",
    "/admin/dashboard",
  ])("redirige %s vers le login", async (path) => {
    expectLoginRedirect(await run(path), path)
  })

  it("conserve la requête dans next pour la publication de mission", async () => {
    const res = await run("/client/missions/new?besoin=Faire%20le%20march%C3%A9&ville=Porto-Novo")
    expectLoginRedirect(res, "/client/missions/new?besoin=Faire%20le%20march%C3%A9&ville=Porto-Novo")
  })

  it("garde la requête pour /student et /admin", async () => {
    expectLoginRedirect(await run("/student/missions?type=Livraison"), "/student/missions?type=Livraison")
    expectLoginRedirect(await run("/admin/users?q=a"), "/admin/users?q=a")
  })

  it("retombe sur le chemin seul si la requête dépasse la limite", async () => {
    const res = await run(`/client/missions/new?besoin=${"a".repeat(600)}`)
    expectLoginRedirect(res, "/client/missions/new")
  })

  it("ne crée pas de redirection ouverte via la requête", async () => {
    const res = await run("/client/x?next=//evil.example")
    expect(res.location?.origin).toBe("http://localhost")
    expectLoginRedirect(res, "/client/x?next=//evil.example")
  })
})

describe("middleware - étudiant", () => {
  beforeEach(() => asUser("student"))

  it("accède à /student/* et /dashboard", async () => {
    expect((await run("/student/missions/x")).location).toBeNull()
    expect((await run("/dashboard")).location).toBeNull()
  })

  it("est renvoyé vers son dashboard depuis /client/*", async () => {
    expect((await run("/client/dashboard")).location?.pathname).toBe("/dashboard")
  })

  it("est renvoyé vers son dashboard depuis /admin/*", async () => {
    expect((await run("/admin/users")).location?.pathname).toBe("/dashboard")
  })
})

describe("middleware - client", () => {
  beforeEach(() => asUser("client"))

  it("ne redirige pas /talents/x", async () => {
    expect((await run("/talents/x")).location).toBeNull()
  })

  it("accède à /client/*", async () => {
    expect((await run("/client/dashboard")).location).toBeNull()
  })

  it("est renvoyé vers son dashboard depuis /student/* et /dashboard", async () => {
    expect((await run("/student/missions/x")).location?.pathname).toBe(
      "/client/dashboard"
    )
    expect((await run("/dashboard")).location?.pathname).toBe("/client/dashboard")
  })
})

describe("middleware - admin", () => {
  beforeEach(() => asUser("admin"))

  it("accède à /admin/*", async () => {
    expect((await run("/admin/dashboard")).location).toBeNull()
  })

  it("est renvoyé vers son dashboard depuis /client/*", async () => {
    expect((await run("/client/dashboard")).location?.pathname).toBe(
      "/admin/dashboard"
    )
  })
})

describe("middleware - routes /auth quand connecté", () => {
  it.each([
    "/auth/register/student",
    "/auth/register/client",
    "/auth/callback",
    "/auth/confirm",
    "/auth/reset-password",
    "/auth/link-expired",
  ])("laisse ouvert %s", async (path) => {
    asUser("student")
    expect((await run(path)).location).toBeNull()
  })

  it("renvoie /auth/login vers le dashboard du rôle", async () => {
    asUser("client")
    expect((await run("/auth/login")).location?.pathname).toBe("/client/dashboard")
  })

  it("honore un next autorisé sur /auth/login", async () => {
    asUser("client")
    const res = await run(
      `/auth/login?next=${encodeURIComponent("/client/missions/new?besoin=Repas&ville=Cotonou")}`
    )
    expect(res.location?.pathname).toBe("/client/missions/new")
    expect(res.location?.search).toBe("?besoin=Repas&ville=Cotonou")
  })

  it("ignore un next refusé pour le rôle, externe ou sous /auth", async () => {
    asUser("student")
    for (const next of ["/client/dashboard", "//evil.example", "https://evil.example", "/auth/login"]) {
      const res = await run(`/auth/login?next=${encodeURIComponent(next)}`)
      expect(res.location?.origin).toBe("http://localhost")
      expect(res.location?.pathname).toBe("/dashboard")
    }
  })

  it("laisse les autres pages /auth au visiteur", async () => {
    asUser(null)
    for (const path of ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/confirm"]) {
      expect((await run(path)).location).toBeNull()
    }
  })

  it("un rôle inconnu dans profiles n'ouvre aucun dashboard (pas de boucle sur /auth/login)", async () => {
    asUser("superadmin")
    const res = await run("/auth/login")
    expect(res.status).toBe(200)
    expect(res.location).toBeNull()
  })
})

describe("middleware - /wallet", () => {
  it("renvoie un visiteur vers le login avec next", async () => {
    asUser(null, null)
    expectLoginRedirect(await run("/wallet"), "/wallet")
    expectLoginRedirect(await run("/wallet/history"), "/wallet/history")
  })

  it("laisse passer un étudiant et redirige les autres rôles vers leur tableau de bord", async () => {
    asUser("student")
    expect((await run("/wallet")).location).toBeNull()
    asUser("client")
    expect((await run("/wallet")).location?.pathname).toBe("/client/dashboard")
    asUser("admin")
    expect((await run("/wallet")).location?.pathname).toBe("/admin/dashboard")
  })

  it("n'affecte pas /walletx ni /client/wallet pour un client", async () => {
    asUser("client")
    expect((await run("/client/wallet")).location).toBeNull()
    asUser(null, null)
    expect((await run("/walletx")).location).toBeNull()
  })
})

describe("middleware - autorité profiles.role", () => {
  it("route selon profiles.role même si user_metadata.role diffère", async () => {
    asUser("student", "admin")
    expect((await run("/admin/dashboard")).location?.pathname).toBe("/dashboard")
    asUser("client", "student")
    expect((await run("/dashboard")).location?.pathname).toBe("/client/dashboard")
    expect((await run("/auth/login")).location?.pathname).toBe("/client/dashboard")
    asUser("admin", "student")
    expect((await run("/admin/users")).location).toBeNull()
  })

  it("compte sans profil : aucun accès aux espaces protégés, quelle que soit la métadonnée", async () => {
    for (const metaRole of ["student", "client", "admin"]) {
      asUser(null, metaRole)
      for (const path of ["/dashboard", "/wallet", "/student/missions", "/client/dashboard", "/admin/dashboard"]) {
        expect((await run(path)).location?.pathname, `${metaRole} ${path}`).toBe("/")
      }
      expect((await run("/auth/login")).location).toBeNull()
    }
  })

  it("rôle null : laisse passer /auth, renvoie vers l'accueil sur un préfixe protégé", async () => {
    asUser(null, null)
    getUser.mockResolvedValue({ data: { user: { id: "u1", user_metadata: {} } } })
    expect((await run("/auth/login")).location).toBeNull()
    for (const path of ["/student/missions", "/client/dashboard", "/admin/users", "/dashboard"]) {
      expect((await run(path)).location?.pathname).toBe("/")
    }
  })

  it("erreur de lecture du profil : fail-closed, aucun repli sur user_metadata", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", user_metadata: { role: "admin" } } } })
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } })
    expect((await run("/admin/dashboard")).location?.pathname).toBe("/")
    expect((await run("/client/dashboard")).location?.pathname).toBe("/")
    expect((await run("/auth/login")).location).toBeNull()
  })

  it("aucune lecture de profil pour un visiteur, une page publique ou une page /auth ouverte", async () => {
    asUser(null, null)
    await run("/client/dashboard")
    await run("/auth/login")
    asUser("student")
    await run("/missions")
    await run("/auth/callback")
    expect(from).not.toHaveBeenCalled()
  })
})

describe("middleware - compte suspendu en cours de session", () => {
  const PROTECTED_PATHS = ["/client/dashboard", "/student/missions", "/admin/dashboard", "/dashboard", "/applications", "/messages", "/profile", "/wallet"]

  it.each(["student", "client", "admin"])("renvoie un %s suspendu vers /auth/login?suspended=1 sur tout préfixe protégé", async (role) => {
    asSuspended(role)
    for (const path of PROTECTED_PATHS) {
      const res = await run(path)
      expect(res.location?.pathname, `${role} ${path}`).toBe("/auth/login")
      expect(res.location?.search, `${role} ${path}`).toBe("?suspended=1")
    }
  })

  it.each(["student", "client", "admin"])("ne renvoie pas un %s suspendu depuis /auth/login vers son espace", async (role) => {
    asSuspended(role)
    const paths = [
      "/auth/login",
      "/auth/login?suspended=1",
      `/auth/login?next=${encodeURIComponent("/client/dashboard")}`,
      "/auth/register",
      "/auth/forgot-password",
      "/auth/verify-email",
    ]
    for (const path of paths) {
      const res = await run(path)
      expect(res.location, `${role} ${path}`).toBeNull()
    }
  })

  it("rejoue la séquence : plus de boucle de redirections pour un client suspendu", async () => {
    asSuspended("client")
    // 1. Le layout client renvoie vers /auth/login?suspended=1 ; on part de /client/dashboard.
    const first = await run("/client/dashboard")
    expect(first.location?.pathname).toBe("/auth/login")
    expect(first.location?.search).toBe("?suspended=1")
    // 2. Le middleware voit /auth/login?suspended=1 : avant correction il renvoyait vers
    // /client/dashboard (ERR_TOO_MANY_REDIRECTS). Désormais la page s'affiche.
    const second = await run(first.location.pathname + first.location.search)
    expect(second.status).toBe(200)
    expect(second.location).toBeNull()
  })

  it("client non suspendu : inchangé", async () => {
    asUser("client")
    expect((await run("/client/dashboard")).location).toBeNull()
    expect((await run("/auth/login")).location?.pathname).toBe("/client/dashboard")
  })

  it("visiteur : inchangé", async () => {
    asUser(null)
    expectLoginRedirect(await run("/client/dashboard"), "/client/dashboard")
    expect((await run("/auth/login")).location).toBeNull()
  })

  it("suspendu sans rôle valide : toujours fail-closed vers l'accueil sur un préfixe protégé", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", user_metadata: {} } } })
    maybeSingle.mockResolvedValue({ data: { role: "root", full_name: "A", city: "B", is_suspended: true }, error: null })
    expect((await run("/client/dashboard")).location?.pathname).toBe("/")
  })
})
