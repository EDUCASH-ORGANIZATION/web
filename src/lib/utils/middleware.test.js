import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const getUser = vi.fn()

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

import { middleware } from "../../../middleware.js"

function asUser(role) {
  getUser.mockResolvedValue({
    data: { user: role ? { user_metadata: { role } } : null },
  })
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
