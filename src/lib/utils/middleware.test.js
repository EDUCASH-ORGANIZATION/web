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

describe("middleware - visiteur", () => {
  beforeEach(() => asUser(null))

  it.each(["/clients", "/talents/x", "/students/x", "/missions", "/"])(
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
})

describe("middleware - étudiant", () => {
  beforeEach(() => asUser("student"))

  it("ne redirige pas /clients", async () => {
    expect((await run("/clients")).location).toBeNull()
  })

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

  it("ne redirige pas /talents/x ni /clients", async () => {
    expect((await run("/talents/x")).location).toBeNull()
    expect((await run("/clients")).location).toBeNull()
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
