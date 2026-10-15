import { describe, it, expect, vi, beforeEach } from "vitest"

const getUser = vi.fn()
const createSignedUrl = vi.fn()

const openaiCtor = vi.hoisted(() => vi.fn())

// Comme le SDK réel : le constructeur lève quand aucune clé n'est fournie.
vi.mock("openai", () => ({
  default: class {
    constructor(options) {
      openaiCtor(options)
      if (!options?.apiKey) throw new Error("Missing credentials. Please pass an `apiKey`.")
    }
    chat = { completions: { create: vi.fn() } }
  },
}))
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
  openaiCtor.mockReset()
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

describe("verifyStudentCardWithAI sans clé OpenAI", () => {
  it("se charge et laisse passer pour examen manuel sans construire le client", async () => {
    vi.stubEnv("OPENAI_API_KEY", "")
    vi.resetModules()
    const { verifyStudentCardWithAI: verify } = await import("./verify-card.actions")
    const res = await verify("u1/card.jpg")
    expect(res.valid).toBe(true)
    expect(openaiCtor).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
