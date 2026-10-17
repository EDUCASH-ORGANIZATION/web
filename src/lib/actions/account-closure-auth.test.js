import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

import { banAuthUser, unbanAuthUser, pseudonymizeAuthUser } from "./account-closure-auth"

const ID = "123e4567-e89b-42d3-a456-426614174000"

const KNOWN_KEYS = [
  "email", "email_verified", "phone_verified", "sub", "full_name", "name", "phone", "avatar_url", "client_type", "role",
]

function makeService(result = { error: null }, getResult = { data: { user: { user_metadata: {} } }, error: null }) {
  const updateUserById = vi.fn().mockResolvedValue(result)
  const getUserById = vi.fn().mockResolvedValue(getResult)
  return {
    service: { auth: { admin: { updateUserById, getUserById, deleteUser: vi.fn() } } },
    updateUserById,
    getUserById,
  }
}

let errorSpy
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => errorSpy.mockRestore())

describe("banAuthUser / unbanAuthUser", () => {
  it("bannit avec la charge utile exacte", async () => {
    const { service, updateUserById } = makeService()
    expect(await banAuthUser(service, ID)).toEqual({ ok: true })
    expect(updateUserById).toHaveBeenCalledTimes(1)
    expect(updateUserById).toHaveBeenCalledWith(ID, { ban_duration: "876000h" })
  })

  it("lève le ban avec la charge utile exacte", async () => {
    const { service, updateUserById } = makeService()
    expect(await unbanAuthUser(service, ID)).toEqual({ ok: true })
    expect(updateUserById).toHaveBeenCalledTimes(1)
    expect(updateUserById).toHaveBeenCalledWith(ID, { ban_duration: "none" })
  })
})

describe("pseudonymizeAuthUser", () => {
  it("envoie la charge utile attendue sans app_metadata ni suppression", async () => {
    const { service, updateUserById } = makeService()
    expect(await pseudonymizeAuthUser(service, ID)).toEqual({ ok: true })
    expect(updateUserById).toHaveBeenCalledTimes(1)
    const [id, attrs] = updateUserById.mock.calls[0]
    expect(id).toBe(ID)
    expect(Object.keys(attrs).sort()).toEqual(
      ["ban_duration", "email", "email_confirm", "password", "user_metadata"],
    )
    expect(attrs.email).toBe(`${ID}@comptes-clotures.invalid`)
    expect(attrs.email_confirm).toBe(true)
    expect(Object.keys(attrs.user_metadata).sort()).toEqual([...KNOWN_KEYS].sort())
    expect(attrs.ban_duration).toBe("876000h")
    expect(attrs.password).toMatch(/^[0-9a-f]{64}$/)
    expect(service.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it("met à null les clés existantes et la liste fermée, sans aucune valeur non nulle", async () => {
    const meta = { full_name: "Awa K", custom_note: "x", nested: { a: 1 }, role: "admin" }
    const { service, updateUserById, getUserById } = makeService(undefined, {
      data: { user: { user_metadata: meta } },
      error: null,
    })
    expect(await pseudonymizeAuthUser(service, ID)).toEqual({ ok: true })
    expect(getUserById).toHaveBeenCalledWith(ID)
    const sent = updateUserById.mock.calls[0][1].user_metadata
    expect(Object.keys(sent).sort()).toEqual([...new Set([...Object.keys(meta), ...KNOWN_KEYS])].sort())
    expect(Object.values(sent).every((v) => v === null)).toBe(true)
  })

  it("utilise la liste fermée seule si la lecture échoue (erreur, exception ou réponse vide)", async () => {
    const failures = [
      makeService(undefined, { data: null, error: { code: "x" } }),
      makeService(undefined, undefined),
      makeService(undefined, { data: { user: null }, error: null }),
    ]
    failures[1].getUserById.mockRejectedValue(new Error("boom"))
    for (const { service, updateUserById } of failures) {
      expect(await pseudonymizeAuthUser(service, ID)).toEqual({ ok: true })
      const sent = updateUserById.mock.calls[0][1].user_metadata
      expect(Object.keys(sent).sort()).toEqual([...KNOWN_KEYS].sort())
      expect(Object.values(sent).every((v) => v === null)).toBe(true)
    }
  })

  it("utilise un mot de passe différent à chaque appel", async () => {
    const { service, updateUserById } = makeService()
    await pseudonymizeAuthUser(service, ID)
    await pseudonymizeAuthUser(service, ID)
    const [a, b] = updateUserById.mock.calls.map((c) => c[1].password)
    expect(a).not.toBe(b)
  })
})

describe.each([
  ["banAuthUser", banAuthUser],
  ["unbanAuthUser", unbanAuthUser],
  ["pseudonymizeAuthUser", pseudonymizeAuthUser],
])("%s : erreurs", (_name, fn) => {
  it("refuse un identifiant invalide sans appel", async () => {
    const { service, updateUserById } = makeService()
    for (const bad of ["", "abc", null, undefined, 12, `${ID}x`]) {
      expect(await fn(service, bad)).toEqual({ ok: false, code: "invalid_user_id" })
    }
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it("renvoie le code d'erreur et ne journalise que lui", async () => {
    const { service } = makeService({
      error: { code: "user_not_found", message: `introuvable ${ID} a@b.co`, status: 404 },
    })
    expect(await fn(service, ID)).toEqual({ ok: false, code: "user_not_found" })
    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).toContain("user_not_found")
    expect(logged).not.toContain(ID)
    expect(logged).not.toContain("a@b.co")
    expect(logged).not.toContain("comptes-clotures")
  })

  it("ne lève jamais d'exception", async () => {
    const service = {
      auth: { admin: { updateUserById: vi.fn().mockRejectedValue(new Error(`boom ${ID}`)) } },
    }
    expect(await fn(service, ID)).toEqual({ ok: false, code: "exception" })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(ID)
  })
})
