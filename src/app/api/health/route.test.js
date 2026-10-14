import { describe, it, expect } from "vitest"
import { GET, dynamic } from "./route.js"

describe("GET /api/health", () => {
  it("répond 200 no-store avec le seul statut", async () => {
    const res = GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(await res.json()).toEqual({ status: "ok" })
    expect(dynamic).toBe("force-dynamic")
  })
})
