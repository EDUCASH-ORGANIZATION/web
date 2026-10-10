import { describe, it, expect, vi, beforeEach } from "vitest"

const send = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("resend", () => ({
  Resend: class {
    emails = { send }
  },
}))

let sendEmail

beforeEach(async () => {
  vi.resetModules()
  send.mockReset()
  send.mockResolvedValue({ error: null })
  process.env.RESEND_API_KEY = "re_test"
  ;({ sendEmail } = await import("./index.js"))
})

describe("sendEmail subject", () => {
  it("utilise options.subject pour contact-message", async () => {
    await sendEmail(
      "contact-message",
      "a@b.bj",
      { name: "A", email: "a@b.bj", subjectLabel: "X", message: "Bonjour" },
      { subject: "Sujet perso" },
    )
    expect(send.mock.calls[0][0].subject).toBe("Sujet perso")
  })

  it("ignore options.subject pour un autre gabarit", async () => {
    await sendEmail("welcome-student", "a@b.bj", {}, { subject: "Sujet injecté" })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].subject).toBe("Bienvenue sur EduCash")
  })
})
