import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { cronAuthGuard, secretsMatch, CRON_SECRET_HEADER } from "../../supabase/functions/_shared/cron-auth.js"

const headers = (value) => new Headers(value === undefined ? {} : { [CRON_SECRET_HEADER]: value })

describe("secretsMatch", () => {
  it("accepte uniquement un secret identique", () => {
    expect(secretsMatch("abc123", "abc123")).toBe(true)
    expect(secretsMatch("abc124", "abc123")).toBe(false)
    expect(secretsMatch("abc12", "abc123")).toBe(false)
    expect(secretsMatch("abc1234", "abc123")).toBe(false)
  })
  it("refuse les valeurs absentes, non textuelles ou un secret attendu vide", () => {
    expect(secretsMatch(null, "abc")).toBe(false)
    expect(secretsMatch(undefined, "abc")).toBe(false)
    expect(secretsMatch("", "")).toBe(false)
    expect(secretsMatch("abc", "")).toBe(false)
    expect(secretsMatch("abc", undefined)).toBe(false)
  })
})

describe("cronAuthGuard", () => {
  it("laisse passer avec le bon secret", () => {
    expect(cronAuthGuard(headers("s3cret"), "s3cret")).toBeNull()
  })

  it("ferme par defaut : 503 si le secret n'est pas configure, meme avec un en-tete", async () => {
    for (const secret of [undefined, null, ""]) {
      const res = cronAuthGuard(headers(""), secret)
      expect(res.status).toBe(503)
      const res2 = cronAuthGuard(headers("anything"), secret)
      expect(res2.status).toBe(503)
      expect(await res2.text()).not.toMatch(/secret|CRON/i)
    }
  })

  it("401 si l'en-tete est absent ou incorrect", async () => {
    for (const value of [undefined, "", "mauvais", "s3cre", "s3crett"]) {
      const res = cronAuthGuard(headers(value), "s3cret")
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: "Non autorisé" })
    }
  })

  it("n'accepte pas le secret dans l'en-tete Authorization", () => {
    const res = cronAuthGuard(new Headers({ Authorization: "Bearer s3cret" }), "s3cret")
    expect(res.status).toBe(401)
  })

  it("joint les en-tetes supplementaires", () => {
    const res = cronAuthGuard(headers("x"), "s3cret", { Vary: "Origin" })
    expect(res.headers.get("Vary")).toBe("Origin")
  })
})

describe("check-verifications-expiry", () => {
  const source = readFileSync(
    path.resolve(import.meta.dirname, "../../supabase/functions/check-verifications-expiry/index.js"),
    "utf8",
  )

  it("controle le secret partage avant toute creation du client de donnees", () => {
    expect(source).toMatch(/cronAuthGuard\(req\.headers, Deno\.env\.get\("CRON_SECRET"\)\)/)
    expect(source.indexOf("cronAuthGuard(")).toBeLessThan(source.indexOf("createClient("))
    expect(source.indexOf("if (denied) return denied")).toBeLessThan(source.indexOf("createClient("))
  })

  it("ne renvoie jamais le message d'erreur de la base au client", () => {
    expect(source).not.toMatch(/JSON\.stringify\(\{ error: fetchError/)
    expect(source).toMatch(/console\.error\("\[check-verifications-expiry\] fetch error:", fetchError\.message\)/)
  })
})
