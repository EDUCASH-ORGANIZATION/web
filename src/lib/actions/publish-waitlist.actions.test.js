import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn() }))
const headerValues = vi.hoisted(() => ({ ip: "10.0.0.1" }))
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name) => (name === "x-forwarded-for" ? headerValues.ip : null) }),
}))

import { sendEmail } from "@/lib/email/index"
import { resetRateLimit, WAITLIST_LIMITS } from "@/lib/publish-waitlist/rate-limit"
import { notifyPublishOpening } from "./publish-waitlist.actions"

function form(values) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  resetRateLimit()
  headerValues.ip = "10.0.0.1"
  vi.mocked(sendEmail).mockReset()
  vi.mocked(sendEmail).mockResolvedValue({ success: true })
  vi.stubEnv("CONTACT_INBOX_EMAIL", "")
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("notifyPublishOpening", () => {
  it("envoie l'email à la boîte de contact par défaut", async () => {
    const r = await notifyPublishOpening(null, form({ email: "awa@exemple.bj" }))
    expect(r).toEqual({ status: "sent" })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const [template, to, data, options] = vi.mocked(sendEmail).mock.calls[0]
    expect(template).toBe("contact-message")
    expect(to).toBe("contact@educash.bj")
    expect(data.email).toBe("awa@exemple.bj")
    expect(options.replyTo).toBe("awa@exemple.bj")
    expect(options.subject).toMatch(/Prévenez-moi/)
  })

  it("utilise CONTACT_INBOX_EMAIL quand elle est définie", async () => {
    vi.stubEnv("CONTACT_INBOX_EMAIL", "equipe@educash.bj")
    await notifyPublishOpening(null, form({ email: "awa@exemple.bj" }))
    expect(vi.mocked(sendEmail).mock.calls[0][1]).toBe("equipe@educash.bj")
  })

  it("email invalide : erreur de champ, aucun envoi", async () => {
    const r = await notifyPublishOpening(null, form({ email: "nope" }))
    expect(r.fieldErrors.email).toBeTruthy()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("honeypot rempli : succès apparent sans envoi", async () => {
    const r = await notifyPublishOpening(null, form({ email: "awa@exemple.bj", website: "x" }))
    expect(r).toEqual({ status: "sent" })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("limite par adresse IP", async () => {
    for (let i = 0; i < WAITLIST_LIMITS.perIp; i++) {
      const r = await notifyPublishOpening(null, form({ email: `p${i}@exemple.bj` }))
      expect(r.status).toBe("sent")
    }
    const blocked = await notifyPublishOpening(null, form({ email: "autre@exemple.bj" }))
    expect(blocked.code).toBe("rate_limited")
    expect(sendEmail).toHaveBeenCalledTimes(WAITLIST_LIMITS.perIp)
  })

  it("limite par adresse email, sans tenir compte de la casse", async () => {
    await notifyPublishOpening(null, form({ email: "Awa@exemple.bj" }))
    await notifyPublishOpening(null, form({ email: "awa@exemple.bj" }))
    const blocked = await notifyPublishOpening(null, form({ email: "AWA@exemple.bj" }))
    expect(blocked.code).toBe("rate_limited")
    expect(sendEmail).toHaveBeenCalledTimes(WAITLIST_LIMITS.perEmail)
  })

  it("échec d'envoi : message vouvoyé, sans détail technique", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ error: "RESEND_API_KEY non configuré" })
    const r = await notifyPublishOpening(null, form({ email: "awa@exemple.bj" }))
    expect(r.code).toBe("send_failed")
    expect(r.formError).toMatch(/Réessayez/)
    expect(JSON.stringify(r)).not.toMatch(/RESEND/)
  })
})
