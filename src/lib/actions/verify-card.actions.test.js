import { describe, it, expect, vi, beforeEach } from "vitest"

const getUser = vi.fn()
const createSignedUrl = vi.fn()

vi.mock("openai", () => ({ default: class { chat = { completions: { create: vi.fn() } } } }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    storage: { from: () => ({ createSignedUrl }) },
  })),
}))

import { verifyStudentCardWithAI } from "./verify-card.actions"

beforeEach(() => {
  getUser.mockReset()
  createSignedUrl.mockReset()
  vi.stubEnv("OPENAI_API_KEY", "sk-test")
  getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
  createSignedUrl.mockResolvedValue({ data: null, error: { message: "stop" } })
})

describe("verifyStudentCardWithAI", () => {
  it("refuse un chemin hors du dossier de l'appelant sans signer d'URL", async () => {
    const res = await verifyStudentCardWithAI("autre-user/card.jpg")
    expect(res.valid).toBe(false)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("refuse une traversée de dossier", async () => {
    const res = await verifyStudentCardWithAI("u1/../autre/card.jpg")
    expect(res.valid).toBe(false)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("accepte un chemin dans le dossier de l'appelant", async () => {
    await verifyStudentCardWithAI("u1/card.jpg")
    expect(createSignedUrl).toHaveBeenCalledWith("u1/card.jpg", 60)
  })
})
