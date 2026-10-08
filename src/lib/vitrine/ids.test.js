import { describe, it, expect } from "vitest"
import { isUuid } from "./ids"

describe("isUuid", () => {
  it("accepte un UUID", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true)
    expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true)
  })
  it("refuse le reste", () => {
    expect(isUuid("abc")).toBe(false)
    expect(isUuid("")).toBe(false)
    expect(isUuid(null)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
    expect(isUuid(42)).toBe(false)
    expect(isUuid("123e4567-e89b-12d3-a456-42661417400g")).toBe(false)
  })
})
