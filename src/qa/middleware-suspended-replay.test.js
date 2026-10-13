import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const getUser = vi.fn()
const maybeSingle = vi.fn()
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }) }))
import { middleware } from "../../middleware.js"

function as(role, suspended) {
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  maybeSingle.mockResolvedValue({ data: { role, full_name: "A", city: "B", is_suspended: suspended }, error: null })
}
// Suit les redirections comme un navigateur ; renvoie la chaîne des chemins, coupe à 10.
async function follow(start) {
  const chain = []
  let url = `http://localhost${start}`
  for (let i = 0; i < 10; i++) {
    const res = await middleware(new NextRequest(url))
    const loc = res.headers.get("location")
    chain.push(new URL(url).pathname + new URL(url).search)
    if (!loc) return { chain, loop: false }
    url = new URL(loc, url).toString()
  }
  return { chain, loop: true }
}

beforeEach(() => { getUser.mockReset(); maybeSingle.mockReset() })

describe("middleware : séquence client suspendu", () => {
  it.each(["/client/dashboard", "/client/anything", "/dashboard", "/admin/dashboard"])("suspendu sur %s : s'arrête sur login, sans boucle", async (p) => {
    as("client", true)
    const { chain, loop } = await follow(p)
    expect(loop).toBe(false)
    expect(chain.at(-1)).toBe("/auth/login?suspended=1")
    expect(chain.length).toBeLessThanOrEqual(2)
  })
  it("suspendu étudiant/admin : pas de boucle non plus", async () => {
    for (const r of ["student", "admin"]) {
      as(r, true)
      for (const p of ["/client/dashboard", "/dashboard", "/admin/dashboard"]) {
        const { loop, chain } = await follow(p); expect(loop, r + p + chain).toBe(false)
      }
    }
  })
  it("client non suspendu inchangé", async () => {
    as("client", false)
    expect((await follow("/client/dashboard")).chain).toEqual(["/client/dashboard"])
    expect((await follow("/auth/login")).chain).toEqual(["/auth/login", "/client/dashboard"])
    expect((await follow("/dashboard")).chain).toEqual(["/dashboard", "/client/dashboard"])
  })
  it("sans session -> login avec next, stable", async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { chain, loop } = await follow("/client/dashboard")
    expect(loop).toBe(false)
    expect(chain[1]).toBe("/auth/login?next=%2Fclient%2Fdashboard")
  })
})
