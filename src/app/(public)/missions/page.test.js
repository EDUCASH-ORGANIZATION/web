// La logique de validation (first, pick, escapeLike) n'est pas exportée de page.js :
// on teste donc le composant serveur lui-même avec un client Supabase factice
// qui enregistre les appels de la requête.
import { describe, it, expect, vi, beforeEach } from "vitest"

const calls = []
let result = { data: [], count: 0, error: null }

function builder() {
  const b = new Proxy(
    {},
    {
      get(_, name) {
        if (name === "then") return (res, rej) => Promise.resolve(result).then(res, rej)
        return (...args) => {
          calls.push([name, ...args])
          return b
        }
      },
    },
  )
  return b
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => builder() }),
}))
vi.mock("next/link", () => ({ default: () => null }))
vi.mock("@/components/vitrine/vitrine-navbar", () => ({ VitrineNavbar: () => null }))
vi.mock("@/components/vitrine/vitrine-footer", () => ({ VitrineFooter: () => null }))
vi.mock("@/components/vitrine/mission-card", () => ({ MissionCard: () => null }))
vi.mock("@/components/vitrine/mission-explorer", () => ({
  MissionSearch: () => null,
  MissionFilterBar: () => null,
}))
vi.mock("@/components/vitrine/missions-pagination", () => ({ MissionsPagination: () => null }))

const { default: MissionsPage } = await import("./page.js")

const run = (sp) => MissionsPage({ searchParams: Promise.resolve(sp) })
const find = (name) => calls.filter((c) => c[0] === name)

beforeEach(() => {
  calls.length = 0
  result = { data: [], count: 0, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("MissionsPage paramètres hostiles", () => {
  it("échappe % et _ et \\ dans q", async () => {
    await run({ q: "%%" })
    expect(find("ilike")[0]).toEqual(["ilike", "title", "%\\%\\%%"])
    calls.length = 0
    await run({ q: "a_b\\c" })
    expect(find("ilike")[0][2]).toBe("%a\\_b\\\\c%")
  })
  it("échappe * dans q", async () => {
    await run({ q: "a*b" })
    expect(find("ilike")[0][2]).toBe("%a\\*b%")
  })
  it("tronque q à 100 caractères", async () => {
    await run({ q: "x".repeat(500) })
    expect(find("ilike")[0][2]).toBe(`%${"x".repeat(100)}%`)
  })
  it("q vide ou espaces : pas de ilike", async () => {
    await run({ q: "   " })
    expect(find("ilike")).toHaveLength(0)
  })
  it("q tableau : premier élément", async () => {
    await run({ q: ["abc", "def"] })
    expect(find("ilike")[0][2]).toBe("%abc%")
  })
  it("budget invalide ignoré", async () => {
    await run({ budget: "abc" })
    expect(find("gte")).toHaveLength(0)
    expect(find("lte")).toHaveLength(0)
  })
  it("budget valide appliqué, tranche ouverte sans lte", async () => {
    await run({ budget: "5000-15000" })
    expect(find("gte")[0]).toEqual(["gte", "budget", 5000])
    expect(find("lte")[0]).toEqual(["lte", "budget", 15000])
    calls.length = 0
    await run({ budget: "30000+" })
    expect(find("gte")).toHaveLength(1)
    expect(find("lte")).toHaveLength(0)
  })
  it("type, ville et tri hors liste ignorés", async () => {
    await run({ type: "x", ville: "Paris", tri: "hack" })
    expect(find("eq").filter((c) => c[1] !== "status")).toHaveLength(0)
    expect(find("order")[0]).toEqual(["order", "created_at", { ascending: false }])
  })
  it("page=-1, 0, abc : page 1", async () => {
    for (const p of ["-1", "0", "abc"]) {
      calls.length = 0
      await run({ page: p })
      expect(find("range")[0]).toEqual(["range", 0, 8])
    }
  })
  it("page=999 : borne calculée, page plafonnée à 100000", async () => {
    await run({ page: "999" })
    expect(find("range")[0]).toEqual(["range", 998 * 9, 998 * 9 + 8])
    calls.length = 0
    await run({ page: "99999999" })
    expect(find("range")[0][1]).toBe(99999 * 9)
  })
  it("PGRST103 traité comme liste vide, sans erreur", async () => {
    result = { data: null, count: null, error: { code: "PGRST103", message: "range" } }
    await expect(run({ page: "999" })).resolves.toBeTruthy()
    expect(console.error).not.toHaveBeenCalled()
  })
  it("autre erreur : journalisée, pas de throw", async () => {
    result = { data: null, count: null, error: { code: "XX", message: "boom" } }
    await expect(run({})).resolves.toBeTruthy()
    expect(console.error).toHaveBeenCalled()
  })
  it("searchParams undefined : ne plante pas", async () => {
    await expect(MissionsPage({ searchParams: Promise.resolve(undefined) })).resolves.toBeTruthy()
  })
})
