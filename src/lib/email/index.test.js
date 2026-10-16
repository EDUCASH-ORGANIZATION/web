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

describe("sendEmail completion-declared", () => {
  it("envoie le sujet attendu au client, sans délai ni prestataire", async () => {
    await sendEmail("completion-declared", "c@b.bj", { studentName: "Awa", missionTitle: "Flyer", missionId: "m1" })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].subject).toBe("Mission terminée : votre confirmation est attendue")
    expect(send.mock.calls[0][0].to).toBe("c@b.bj")
  })
})

describe("sendEmail journal", () => {
  it("n'écrit aucune donnée du message d'erreur ou de l'exception dans le journal", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    send.mockResolvedValueOnce({ error: { name: "validation_error", statusCode: 403, message: "domain not verified for client@exemple.bj" } })
    await sendEmail("welcome-student", "client@exemple.bj", {})
    send.mockRejectedValueOnce(new Error("boom client@exemple.bj"))
    await sendEmail("welcome-student", "client@exemple.bj", {})
    expect(spy).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/client@exemple|domain not verified|boom/)
    spy.mockRestore()
  })
})
