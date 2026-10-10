import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))
const createClient = vi.hoisted(() => vi.fn(() => ({ marker: "service" })))
vi.mock("@supabase/supabase-js", () => ({ createClient }))

import { createServiceClient } from "./service.js"

describe("createServiceClient", () => {
  beforeEach(() => {
    createClient.mockClear()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "cle-factice")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("crée un client sans session persistée", () => {
    const client = createServiceClient()
    expect(client).toEqual({ marker: "service" })
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "cle-factice", {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })

  it("échoue explicitement si la clé service role manque", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    expect(() => createServiceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
    expect(createClient).not.toHaveBeenCalled()
  })

  it("échoue explicitement si l'URL manque", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(() => createServiceClient()).toThrow()
  })
})
