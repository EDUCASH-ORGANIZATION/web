import { beforeEach, describe, expect, it } from "vitest"
import { WAITLIST_LIMITS, isRateLimited, resetRateLimit } from "./rate-limit"

beforeEach(() => resetRateLimit())

describe("isRateLimited", () => {
  it("laisse passer jusqu'à la limite puis refuse", () => {
    expect(isRateLimited("k", 2, 1000)).toBe(false)
    expect(isRateLimited("k", 2, 1001)).toBe(false)
    expect(isRateLimited("k", 2, 1002)).toBe(true)
  })

  it("compte chaque clé séparément", () => {
    expect(isRateLimited("a", 1, 1000)).toBe(false)
    expect(isRateLimited("a", 1, 1001)).toBe(true)
    expect(isRateLimited("b", 1, 1001)).toBe(false)
  })

  it("rouvre après la fenêtre", () => {
    expect(isRateLimited("k", 1, 1000)).toBe(false)
    expect(isRateLimited("k", 1, 1000 + WAITLIST_LIMITS.windowMs - 1)).toBe(true)
    expect(isRateLimited("k", 1, 1000 + WAITLIST_LIMITS.windowMs)).toBe(false)
  })

  it("ne compte pas un refus comme une tentative de plus", () => {
    isRateLimited("k", 1, 0)
    for (let i = 1; i < 50; i++) isRateLimited("k", 1, i)
    expect(isRateLimited("k", 1, WAITLIST_LIMITS.windowMs)).toBe(false)
  })
})
