import { describe, it, expect } from "vitest"
import { isInternalPath } from "./internal-path"

describe("isInternalPath", () => {
  it.each(["/", "/dashboard", "/auth/login?suspended=1", "/client/dashboard"])("accepte %s", (p) => {
    expect(isInternalPath(p)).toBe(true)
  })

  it.each(["/..", "/.", "/a/..", "/a/../b", "/./a", "/..//evil.com", "/a/%2e%2e/b", "/%2E/a", "/a/..?x=1"])(
    "refuse le segment de navigation %s",
    (p) => {
      expect(isInternalPath(p)).toBe(false)
    }
  )

  it.each(["/%2F/evil.com", "/a/.b", "/a/b..c", "/a/...", "/a?next=/../x", "/a#/../x"])("accepte %s (même origine, pas de segment . ou ..)", (p) => {
    expect(isInternalPath(p)).toBe(true)
  })

  it("plafonne la longueur à 512 caractères", () => {
    expect(isInternalPath("/" + "a".repeat(511))).toBe(true)
    expect(isInternalPath("/" + "a".repeat(512))).toBe(false)
    expect(isInternalPath("/" + "a".repeat(100000))).toBe(false)
  })

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", "/a\\b", "/a\nb", null, undefined, 42, {}])(
    "refuse %s",
    (p) => {
      expect(isInternalPath(p)).toBe(false)
    }
  )
})
