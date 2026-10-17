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

describe("sendEmail demandes d'achats", () => {
  const props = { missionTitle: "Courses", missionId: "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10", studentId: "22222222-2222-4222-8222-222222222221", requestId: "33333333-3333-4333-8333-333333333331" }

  it.each([
    ["purchase-requested", "Nouvelle demande de paiement d’achats"],
    ["purchase-paid", "Paiement indiqué : confirmez la réception"],
    ["purchase-reported", "Une demande d’achats a été signalée"],
  ])("%s : sujet fixe, rendu envoyé à l'adresse donnée", async (template, subject) => {
    expect(await sendEmail(template, "a@b.bj", props)).toEqual({ success: true })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].subject).toBe(subject)
    expect(send.mock.calls[0][0].to).toBe("a@b.bj")
    expect(send.mock.calls[0][0].react).toBeTruthy()
  })

  it("domaine non vérifié (403) : retourne une erreur sans lever", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    send.mockResolvedValueOnce({ error: { name: "validation_error", statusCode: 403, message: "domain not verified" } })
    expect(await sendEmail("purchase-requested", "a@b.bj", props)).toEqual({ error: "domain not verified" })
    spy.mockRestore()
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

describe("sendEmail comptes fermes", () => {
  const uuid = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"

  it.each([
    ["account-closed", "Votre compte EduCash est fermé"],
    ["account-reopened", "Votre compte EduCash est réactivé"],
  ])("%s : sujet fixe, rendu envoyé à l'adresse donnée", async (template, subject) => {
    expect(await sendEmail(template, "a@b.bj", { name: "Awa" })).toEqual({ success: true })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].subject).toBe(subject)
    expect(send.mock.calls[0][0].to).toBe("a@b.bj")
  })

  it.each([
    [`${uuid}@comptes-clotures.invalid`],
    [`${uuid.toUpperCase()}@Comptes-Clotures.Invalid`],
    [["a@b.bj", `${uuid}@comptes-clotures.invalid`]],
  ])("adresse pseudonyme %j : refus sans appel Resend ni adresse dans le journal", async (to) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const result = await sendEmail("welcome-student", to, {})
    expect(result).toHaveProperty("error")
    expect(send).not.toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/comptes-clotures|a@b\.bj|0b8f1c1e/i)
    expect(JSON.stringify(result)).not.toMatch(/comptes-clotures|0b8f1c1e/i)
    warn.mockRestore()
  })
})
