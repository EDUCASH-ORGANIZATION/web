import { afterEach, describe, expect, it, vi } from "vitest"
import { PAYMENTS_PENDING_COPY, paymentsEnabled } from "./payments"

afterEach(() => vi.unstubAllEnvs())

describe("paymentsEnabled", () => {
  it("est faux quand la variable est absente", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "")
    delete process.env.PAYMENTS_ENABLED
    expect(paymentsEnabled()).toBe(false)
  })

  it.each(["false", "1", "TRUE", "True", " true", "yes", ""])("est faux pour %j", (value) => {
    vi.stubEnv("PAYMENTS_ENABLED", value)
    expect(paymentsEnabled()).toBe(false)
  })

  it("est vrai seulement pour exactement « true »", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true")
    expect(paymentsEnabled()).toBe(true)
  })

  it("ne passe jamais par une variable NEXT_PUBLIC", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "")
    vi.stubEnv("NEXT_PUBLIC_PAYMENTS_ENABLED", "true")
    expect(paymentsEnabled()).toBe(false)
  })
})

describe("PAYMENTS_PENDING_COPY", () => {
  it("porte le message demandé, vouvoie le client comme l'étudiant", () => {
    expect(PAYMENTS_PENDING_COPY.wallet.title).toBe("Recharge et retrait en cours d'activation")
    expect(PAYMENTS_PENDING_COPY.wallet.client).toMatch(/\bvos?\b/i)
    expect(PAYMENTS_PENDING_COPY.wallet.client).not.toMatch(/\b(ton|ta|tes|tu)\b/i)
    // Registre unique (RD-VOUS-01) : la version étudiante est vouvoyée aussi.
    expect(PAYMENTS_PENDING_COPY.wallet.student).toMatch(/\bvos?\b/i)
    expect(PAYMENTS_PENDING_COPY.wallet.student).not.toMatch(/\b(ton|ta|tes|tu)\b/i)
    expect(PAYMENTS_PENDING_COPY.publish.title).toBe("Publication en cours d'activation")
  })
})
