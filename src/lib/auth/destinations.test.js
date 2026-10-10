import { describe, it, expect } from "vitest"
import {
  dashboardFor,
  onboardingPathFor,
  withNext,
  loginHref,
  registerHref,
  audienceFor,
  resolvePostAuth,
  authRedirectUrl,
  linkErrorCause,
  knownRole,
} from "./destinations.js"
import { safeNextPath, isNextAllowedForRole } from "@/lib/utils/safe-next"

const PUBLISH = "/client/missions/new?besoin=Repas&ville=Cotonou&type=Livraison"
const ENCODED_PUBLISH = encodeURIComponent(PUBLISH)

describe("dashboardFor et onboardingPathFor", () => {
  it("associe chaque rôle à son tableau de bord", () => {
    expect(dashboardFor("student")).toBe("/dashboard")
    expect(dashboardFor("client")).toBe("/client/dashboard")
    expect(dashboardFor("admin")).toBe("/admin/dashboard")
    expect(dashboardFor("root")).toBeNull()
    expect(dashboardFor(undefined)).toBeNull()
  })

  it("n'a d'onboarding que pour student et client", () => {
    expect(onboardingPathFor("student")).toBe("/auth/register/student")
    expect(onboardingPathFor("client")).toBe("/auth/register/client")
    expect(onboardingPathFor("admin")).toBeNull()
  })
})

describe("withNext, loginHref, registerHref", () => {
  it("encode le next et conserve son pré-remplissage", () => {
    expect(withNext("/auth/login", PUBLISH)).toBe(`/auth/login?next=${ENCODED_PUBLISH}`)
    expect(loginHref({ next: PUBLISH })).toBe(`/auth/login?next=${ENCODED_PUBLISH}`)
  })

  it("ignore un next dangereux ou absent", () => {
    for (const next of ["//evil.tld", "https://evil.tld", "/auth/login", "/api/x", "", undefined, null]) {
      expect(loginHref({ next })).toBe("/auth/login")
    }
    expect(loginHref()).toBe("/auth/login")
  })

  it("ajoute le next avec & quand le chemin a déjà une requête", () => {
    expect(withNext("/a?x=1", "/dashboard")).toBe("/a?x=1&next=%2Fdashboard")
  })

  it("registerHref : role, next et alias redirect", () => {
    expect(registerHref({ role: "client", next: PUBLISH })).toBe(`/auth/register?role=client&next=${ENCODED_PUBLISH}`)
    expect(registerHref({ role: "student" })).toBe("/auth/register?role=student")
    expect(registerHref({ redirect: "/student/missions/abc" })).toBe("/auth/register?next=%2Fstudent%2Fmissions%2Fabc")
    expect(registerHref({ next: "/dashboard", redirect: "/messages" })).toBe("/auth/register?next=%2Fdashboard")
    expect(registerHref({ role: "admin" })).toBe("/auth/register")
    expect(registerHref({ role: "admin", next: "//x" })).toBe("/auth/register")
    expect(registerHref()).toBe("/auth/register")
  })
})

describe("audienceFor", () => {
  it.each([
    [{ role: "client" }, "client"],
    [{ role: "student" }, "student"],
    [{ next: PUBLISH }, "client"],
    [{ next: "/client" }, "client"],
    [{ next: "/clients" }, "student"],
    [{ next: "/student/missions/abc" }, "student"],
    [{ role: "admin", next: "/client/x" }, "client"],
    [{ role: "student", next: PUBLISH }, "client"],
    [{ next: "//client/x" }, "student"],
    [{}, "student"],
    [undefined, "student"],
  ])("%j -> %s", (input, expected) => {
    expect(audienceFor(input)).toBe(expected)
  })

  it("accepte un public par défaut", () => {
    expect(audienceFor({}, "client")).toBe("client")
    expect(audienceFor({ role: "student" }, "client")).toBe("client")
  })
})

describe("resolvePostAuth", () => {
  it.each([
    ["student", true, "/student/missions/abc", "/student/missions/abc"],
    ["student", true, "/dashboard", "/dashboard"],
    ["student", true, PUBLISH, "/dashboard"],
    ["student", true, "/admin/dashboard", "/dashboard"],
    ["student", true, undefined, "/dashboard"],
    ["client", true, PUBLISH, PUBLISH],
    ["client", true, "/client/wallet", "/client/wallet"],
    ["client", true, "/dashboard", "/client/dashboard"],
    ["client", true, "/wallet", "/client/dashboard"],
    ["client", true, undefined, "/client/dashboard"],
    ["admin", true, "/admin/users", "/admin/users"],
    ["admin", false, undefined, "/admin/dashboard"],
  ])("%s complet=%s next=%j -> %s", (role, profileComplete, next, expected) => {
    expect(resolvePostAuth({ role, profileComplete, next })).toBe(expected)
  })

  it("envoie un profil incomplet vers l'onboarding en gardant le next autorisé", () => {
    expect(resolvePostAuth({ role: "client", profileComplete: false, next: PUBLISH })).toBe(
      `/auth/register/client?next=${ENCODED_PUBLISH}`
    )
    expect(resolvePostAuth({ role: "student", profileComplete: false, next: "/student/missions/abc" })).toBe(
      "/auth/register/student?next=%2Fstudent%2Fmissions%2Fabc"
    )
    expect(resolvePostAuth({ role: "student", profileComplete: false })).toBe("/auth/register/student")
  })

  it("retire du onboarding un next refusé pour le rôle", () => {
    expect(resolvePostAuth({ role: "student", profileComplete: false, next: PUBLISH })).toBe("/auth/register/student")
  })

  it.each(["//evil.tld", "https://evil.tld/x", "/auth/login", "/auth/register/client", "/api/logout", "javascript:alert(1)", "/\\evil"])(
    "ne renvoie jamais %j",
    (next) => {
      for (const role of ["student", "client", "admin"]) {
        for (const profileComplete of [true, false]) {
          const result = resolvePostAuth({ role, profileComplete, next })
          expect(result).not.toContain(encodeURIComponent(next))
          const path = result.split("?")[0]
          expect(path.startsWith("//")).toBe(false)
          const candidate = new URLSearchParams(result.split("?")[1] ?? "").get("next") ?? result
          if (candidate !== result || !["/dashboard", "/client/dashboard", "/admin/dashboard"].includes(result)) {
            expect(safeNextPath(candidate) === null || isNextAllowedForRole(candidate, role)).toBe(true)
          }
        }
      }
    }
  )

  it("ne donne jamais de next à un rôle inconnu", () => {
    for (const role of [undefined, null, "", "superadmin"]) {
      expect(resolvePostAuth({ role, profileComplete: true, next: "/dashboard" })).toBe("/")
      expect(resolvePostAuth({ role, profileComplete: false, next: "/dashboard" })).toBe("/")
    }
    expect(resolvePostAuth()).toBe("/")
  })
})

describe("authRedirectUrl", () => {
  it("construit l'URL de retour des emails", () => {
    expect(authRedirectUrl({ appUrl: "https://educash.bj", flow: "signup" })).toBe("https://educash.bj/auth/confirm?flow=signup")
    expect(authRedirectUrl({ appUrl: "https://educash.bj/", flow: "recovery" })).toBe("https://educash.bj/auth/confirm?flow=recovery")
    expect(authRedirectUrl({ appUrl: "http://localhost:3299", flow: "signup", next: PUBLISH })).toBe(
      `http://localhost:3299/auth/confirm?flow=signup&next=${ENCODED_PUBLISH}`
    )
  })

  it("ignore un next dangereux et refuse un flux inconnu", () => {
    expect(authRedirectUrl({ appUrl: "https://educash.bj", flow: "signup", next: "//evil.tld" })).toBe(
      "https://educash.bj/auth/confirm?flow=signup"
    )
    expect(() => authRedirectUrl({ appUrl: "https://educash.bj", flow: "magic" })).toThrow()
  })
})

describe("linkErrorCause", () => {
  it.each([
    [{ error: "access_denied", error_code: "otp_expired", error_description: "Email link is invalid or has expired" }, "expire"],
    [{ error_code: "otp_expired" }, "expire"],
    [{ code: "flow_state_expired" }, "expire"],
    [{ message: "Token has expired or is invalid" }, "expire"],
    [{ code: "bad_code_verifier" }, "autre-appareil"],
    [{ message: "PKCE code verifier not found in storage" }, "autre-appareil"],
    [{ error_description: "invalid request: both auth code and code verifier should be non-empty" }, "autre-appareil"],
    [{ code: "flow_state_not_found" }, "utilise"],
    [{ message: "This link has already been used" }, "utilise"],
    [{ error: "access_denied" }, "invalide"],
    [{ code: "validation_failed" }, "invalide"],
    [{}, "invalide"],
    [undefined, "invalide"],
  ])("%j -> %s", (params, expected) => {
    expect(linkErrorCause(params)).toBe(expected)
  })

  it("lit des URLSearchParams", () => {
    expect(linkErrorCause(new URLSearchParams("error=access_denied&error_code=otp_expired"))).toBe("expire")
    expect(linkErrorCause(new URLSearchParams(""))).toBe("invalide")
  })
})

describe("knownRole", () => {
  it("accepte un role explicite student ou client", () => {
    expect(knownRole("student", undefined)).toBe("student")
    expect(knownRole("client", undefined)).toBe("client")
  })

  it("ignore admin et les valeurs inconnues", () => {
    expect(knownRole("admin", undefined)).toBeNull()
    expect(knownRole("", undefined)).toBeNull()
  })

  it("déduit le public d'un next", () => {
    expect(knownRole(undefined, PUBLISH)).toBe("client")
    expect(knownRole(undefined, "/dashboard")).toBe("student")
    expect(knownRole(undefined, "/missions")).toBeNull()
  })
})
