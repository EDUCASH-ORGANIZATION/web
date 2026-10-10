import { describe, it, expect } from "vitest"
import { mapAuthError, authErrorCode, authErrorMessage } from "./errors"

describe("authErrorCode", () => {
  it.each([
    [{ code: "invalid_credentials" }, "invalid_credentials"],
    [{ message: "Invalid login credentials" }, "invalid_credentials"],
    [{ code: "email_not_confirmed" }, "email_not_confirmed"],
    [{ message: "Email not confirmed" }, "email_not_confirmed"],
    [{ message: "User already registered" }, "email_taken"],
    [{ code: "user_already_exists" }, "email_taken"],
    [{ code: "over_email_send_rate_limit" }, "rate_limited"],
    [{ status: 429, message: "x" }, "rate_limited"],
    [{ message: "For security purposes, you can only request this after 20 seconds" }, "rate_limited"],
    [{ code: "same_password" }, "same_password"],
    [{ message: "Auth session missing!" }, "session_expired"],
    [{ code: "otp_expired" }, "session_expired"],
    [{ name: "AuthRetryableFetchError", status: 0, message: "fetch failed" }, "network"],
    [{ message: "boom" }, "unknown"],
    [null, "unknown"],
  ])("%j -> %s", (error, expected) => {
    expect(authErrorCode(error)).toBe(expected)
  })
})

describe("mapAuthError", () => {
  it("tutoie l'étudiant et vouvoie le client", () => {
    const s = mapAuthError({ code: "over_request_rate_limit" }, "student")
    const c = mapAuthError({ code: "over_request_rate_limit" }, "client")
    expect(s).toEqual({ code: "rate_limited", message: "Trop de tentatives. Réessaie dans quelques minutes." })
    expect(c.message).toBe("Trop de tentatives. Réessayez dans quelques minutes.")
  })

  it("ne renvoie jamais le message anglais brut", () => {
    const r = mapAuthError({ message: "Database error saving new user" }, "student")
    expect(r.code).toBe("unknown")
    expect(r.message).not.toMatch(/database/i)
  })

  it("couvre chaque code pour les deux audiences, sans tiret cadratin", () => {
    const codes = [
      "invalid_credentials", "email_not_confirmed", "rate_limited", "session_expired",
      "network", "email_taken", "suspended", "same_password", "weak_password", "unknown",
    ]
    for (const audience of ["student", "client"]) {
      for (const code of codes) {
        const message = authErrorMessage(code, audience)
        expect(message.length).toBeGreaterThan(5)
        expect(message).not.toContain(String.fromCharCode(0x2014))
      }
    }
  })
})
