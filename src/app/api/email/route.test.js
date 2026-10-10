import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn() }))

import { sendEmail } from "@/lib/email/index"
import { POST } from "./route"

function req(body, auth) {
  return new Request("http://localhost/api/email", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const valid = { template: "welcome-student", to: "a@b.co", data: { firstName: "A" } }

describe("POST /api/email", () => {
  const original = process.env.INTERNAL_API_SECRET
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    sendEmail.mockResolvedValue({ success: true })
  })
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_API_SECRET
    else process.env.INTERNAL_API_SECRET = original
  })

  it("refuse et n'envoie rien si le secret est absent", async () => {
    delete process.env.INTERNAL_API_SECRET
    const res = await POST(req(valid, "Bearer undefined"))
    expect(res.status).toBe(503)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("refuse si le secret est vide", async () => {
    process.env.INTERNAL_API_SECRET = ""
    const res = await POST(req(valid, "Bearer "))
    expect(res.status).toBe(503)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("401 avec un mauvais secret ou sans en-tête", async () => {
    process.env.INTERNAL_API_SECRET = "s3cret"
    expect((await POST(req(valid, "Bearer wrong!"))).status).toBe(401)
    expect((await POST(req(valid, "Bearer x"))).status).toBe(401)
    expect((await POST(req(valid))).status).toBe(401)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("envoie avec le bon secret", async () => {
    process.env.INTERNAL_API_SECRET = "s3cret"
    const res = await POST(req(valid, "Bearer s3cret"))
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledWith("welcome-student", "a@b.co", { firstName: "A" })
  })

  it("rejette gabarit inconnu, destinataires multiples et email invalide", async () => {
    process.env.INTERNAL_API_SECRET = "s3cret"
    const auth = "Bearer s3cret"
    expect((await POST(req({ ...valid, template: "evil" }, auth))).status).toBe(400)
    expect((await POST(req({ ...valid, to: ["a@b.co", "c@d.co"] }, auth))).status).toBe(400)
    expect((await POST(req({ ...valid, to: "a@b.co,c@d.co" }, auth))).status).toBe(400)
    expect((await POST(req({ ...valid, to: "pas-un-email" }, auth))).status).toBe(400)
    expect((await POST(req("{", auth))).status).toBe(400)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("ne divulgue pas le détail d'une erreur d'envoi", async () => {
    process.env.INTERNAL_API_SECRET = "s3cret"
    sendEmail.mockResolvedValue({ error: "RESEND_API_KEY non configuré" })
    const res = await POST(req(valid, "Bearer s3cret"))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain("RESEND")
  })
})
