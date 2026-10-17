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
  it("vouvoie tous les publics : l'argument audience n'a plus d'effet sur le ton", () => {
    const expected = { code: "rate_limited", message: "Trop de tentatives. Réessayez dans quelques minutes." }
    expect(mapAuthError({ code: "over_request_rate_limit" })).toEqual(expected)
    expect(mapAuthError({ code: "over_request_rate_limit" }, "student")).toEqual(expected)
    expect(mapAuthError({ code: "over_request_rate_limit" }, "client")).toEqual(expected)
  })

  it("ne renvoie jamais le message anglais brut", () => {
    const r = mapAuthError({ message: "Database error saving new user" }, "student")
    expect(r.code).toBe("unknown")
    expect(r.message).not.toMatch(/database/i)
  })

  it("couvre chaque code, vouvoyé et sans tiret cadratin", () => {
    const codes = [
      "invalid_credentials", "email_not_confirmed", "rate_limited", "session_expired",
      "network", "email_taken", "suspended", "same_password", "weak_password", "unknown",
    ]
    for (const code of codes) {
      const message = authErrorMessage(code)
      expect(message.length).toBeGreaterThan(5)
      expect(message).not.toContain(String.fromCharCode(0x2014))
      expect(message).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})|[a-zé]+-toi/iu)
    }
  })
})

describe("compte fermé (banni)", () => {
  it.each([
    [{ code: "user_banned", status: 400, message: "User is banned" }],
    [{ message: "User is banned" }],
  ])("%j -> user_banned", (error) => {
    expect(authErrorCode(error)).toBe("user_banned")
    expect(mapAuthError(error).message).toBe(
      "Ce compte est fermé. Pour demander sa réactivation, écrivez-nous à contact@educash.bj.",
    )
  })

  it("après pseudonymisation l'adresse ne correspond plus : identifiants incorrects", () => {
    expect(mapAuthError({ code: "invalid_credentials" }).message).toBe("Email ou mot de passe incorrect.")
  })
})
