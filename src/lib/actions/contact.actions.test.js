import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn() }))

import { sendEmail } from "@/lib/email/index"
import { sendContactMessage } from "./contact.actions"

function form(values) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

const valid = {
  name: "Sèna Agossou",
  email: "sena@exemple.bj",
  subject: "paiement",
  message: "Bonjour, mon retrait est en cours.",
}

beforeEach(() => {
  vi.mocked(sendEmail).mockReset()
  vi.mocked(sendEmail).mockResolvedValue({ success: true })
  vi.stubEnv("CONTACT_INBOX_EMAIL", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("sendContactMessage", () => {
  it("honeypot rempli : succès sans envoi", async () => {
    const r = await sendContactMessage(form({ ...valid, website: "spam" }))
    expect(r).toEqual({ status: "success" })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("données invalides : invalid sans envoi", async () => {
    const r = await sendContactMessage(form({ ...valid, email: "nope" }))
    expect(r.status).toBe("invalid")
    expect(r.fieldErrors.email).toBeDefined()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("destinataire par défaut et replyTo = email saisi", async () => {
    const r = await sendContactMessage(form(valid))
    expect(r).toEqual({ status: "success" })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const [template, to, data, options] = vi.mocked(sendEmail).mock.calls[0]
    expect(template).toBe("contact-message")
    expect(to).toBe("contact@educash.bj")
    expect(data).toMatchObject({ name: valid.name, email: valid.email, subjectLabel: "Paiement, séquestre ou retrait" })
    expect(options.replyTo).toBe(valid.email)
    expect(options.subject).toBe("Contact EduCash : Paiement, séquestre ou retrait")
  })

  it("destinataire fixé par CONTACT_INBOX_EMAIL, jamais par le formulaire", async () => {
    vi.stubEnv("CONTACT_INBOX_EMAIL", "equipe@educash.bj")
    await sendContactMessage(form({ ...valid, to: "evil@x.tld" }))
    expect(vi.mocked(sendEmail).mock.calls[0][1]).toBe("equipe@educash.bj")
  })

  it("erreur d'envoi : status error, sans donnée personnelle journalisée", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ error: "boom" })
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await sendContactMessage(form(valid))
    expect(r.status).toBe("error")
    expect(r.message).toBeTruthy()
    expect(JSON.stringify(spy.mock.calls)).not.toContain(valid.email)
  })
})
