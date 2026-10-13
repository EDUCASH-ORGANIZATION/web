import { describe, it, expect } from "vitest"
import { isInternalPath } from "./internal-path"

describe("isInternalPath", () => {
  it.each(["/", "/dashboard", "/auth/login?suspended=1", "/client/dashboard"])("accepte %s", (p) => {
    expect(isInternalPath(p)).toBe(true)
  })

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", "/a\\b", "/a\nb", null, undefined, 42, {}])(
    "refuse %s",
    (p) => {
      expect(isInternalPath(p)).toBe(false)
    }
  )
})
