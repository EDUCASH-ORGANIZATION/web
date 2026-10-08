import { describe, it, expect } from "vitest"
import { safeNextPath, isNextAllowedForRole } from "./safe-next"

const UUID = "123e4567-e89b-42d3-a456-426614174000"

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath(`/student/missions/${UUID}`)).toBe(`/student/missions/${UUID}`)
    expect(safeNextPath("/missions/abc?x=1#top")).toBe("/missions/abc?x=1#top")
    expect(safeNextPath("/")).toBe("/")
    expect(safeNextPath("/authors")).toBe("/authors")
  })

  it.each([
    ["//evil.tld", "double slash"],
    ["//", "double slash seul"],
    ["/\\evil", "slash antislash"],
    ["/\\\\evil", "slash double antislash"],
    ["/a\\b", "antislash au milieu"],
    ["https://evil.tld", "URL absolue"],
    ["http://evil.tld", "URL http"],
    ["javascript:alert(1)", "schéma javascript"],
    ["data:text/html,x", "schéma data"],
    ["evil.tld", "sans slash initial"],
    ["student/missions", "chemin relatif"],
    [" /student", "espace initial"],
    ["/\tevil", "tabulation"],
    ["/\nevil", "saut de ligne"],
    ["/\revil", "retour chariot"],
    ["/\u0000evil", "caractère nul"],
    ["/auth/login", "anti-boucle"],
    ["/auth", "anti-boucle racine"],
    ["/auth/login?next=/x", "anti-boucle avec query"],
    ["/api/x", "api"],
    ["/api", "api racine"],
    ["/" + "a".repeat(599), "trop long"],
    ["", "vide"],
    [null, "null"],
    [undefined, "undefined"],
    [42, "non chaîne"],
    [["/x"], "tableau"],
  ])("refuse %j (%s)", (raw) => {
    expect(safeNextPath(raw)).toBeNull()
  })

  it("accepte exactement 512 caractères et refuse 513", () => {
    expect(safeNextPath("/" + "a".repeat(511))).not.toBeNull()
    expect(safeNextPath("/" + "a".repeat(512))).toBeNull()
  })
})

describe("isNextAllowedForRole", () => {
  it("student : tout sauf /client et /admin", () => {
    expect(isNextAllowedForRole(`/student/missions/${UUID}`, "student")).toBe(true)
    expect(isNextAllowedForRole("/missions/x", "student")).toBe(true)
    expect(isNextAllowedForRole("/clients", "student")).toBe(true)
    expect(isNextAllowedForRole("/client/dashboard", "student")).toBe(false)
    expect(isNextAllowedForRole("/client", "student")).toBe(false)
    expect(isNextAllowedForRole("/admin/dashboard", "student")).toBe(false)
  })

  it("client : /client/* ou chemin public", () => {
    expect(isNextAllowedForRole("/client/dashboard", "client")).toBe(true)
    expect(isNextAllowedForRole("/missions/x", "client")).toBe(true)
    expect(isNextAllowedForRole("/talents/x", "client")).toBe(true)
    expect(isNextAllowedForRole("/student/missions/x", "client")).toBe(false)
    expect(isNextAllowedForRole("/dashboard", "client")).toBe(false)
    expect(isNextAllowedForRole("/wallet", "client")).toBe(false)
    expect(isNextAllowedForRole("/admin/users", "client")).toBe(false)
  })

  it("admin : tout chemin sûr", () => {
    expect(isNextAllowedForRole("/admin/dashboard", "admin")).toBe(true)
    expect(isNextAllowedForRole("/client/dashboard", "admin")).toBe(true)
    expect(isNextAllowedForRole("/student/missions/x", "admin")).toBe(true)
  })

  it("rôle inconnu ou chemin invalide : refusé", () => {
    expect(isNextAllowedForRole("/missions/x", "hacker")).toBe(false)
    expect(isNextAllowedForRole("/missions/x", undefined)).toBe(false)
    expect(isNextAllowedForRole(null, "admin")).toBe(false)
  })
})
