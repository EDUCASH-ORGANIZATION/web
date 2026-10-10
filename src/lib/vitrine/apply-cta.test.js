import { describe, it, expect } from "vitest"
import { applyCta } from "./apply-cta"

const ID = "123e4567-e89b-12d3-a456-426614174000"
const base = { missionId: ID, missionType: "Cours particuliers", accepting: true, hasApplied: false }

describe("applyCta", () => {
  it("mission fermée", () => {
    const r = applyCta({ ...base, role: "student", accepting: false })
    expect(r.kind).toBe("closed")
    expect(r.message).toBe("Cette mission n'accepte plus de candidatures")
    expect(r.primary).toEqual({
      label: "Voir des missions similaires",
      href: "/missions?type=Cours%20particuliers",
    })
    expect(r.secondary).toBeNull()
  })
  it("visiteur avec next encodé", () => {
    const r = applyCta({ ...base, role: null })
    expect(r.kind).toBe("visitor")
    expect(r.primary.label).toBe("Se connecter pour postuler")
    expect(r.primary.href).toBe(
      `/auth/login?next=${encodeURIComponent(`/student/missions/${ID}`)}`
    )
    expect(r.primary.href).toContain("%2Fstudent%2Fmissions%2F")
    expect(r.secondary).toEqual({
      label: "Créer un compte étudiant",
      href: `/auth/register?role=student&next=${encodeURIComponent(`/student/missions/${ID}`)}`,
    })
  })
  it("étudiant ayant déjà postulé", () => {
    const r = applyCta({ ...base, role: "student", hasApplied: true })
    expect(r.kind).toBe("student-applied")
    expect(r.primary).toEqual({ label: "Voir ma candidature", href: "/applications" })
  })
  it("étudiant", () => {
    const r = applyCta({ ...base, role: "student" })
    expect(r.kind).toBe("student")
    expect(r.primary).toEqual({ label: "Postuler", href: `/student/missions/${ID}` })
  })
  it("client", () => {
    const r = applyCta({ ...base, role: "client" })
    expect(r.kind).toBe("client")
    expect(r.message).toBe("Les candidatures sont réservées aux étudiants.")
    expect(r.primary).toEqual({
      label: "Publier une mission similaire",
      href: "/client/missions/new",
    })
  })
  it("admin", () => {
    const r = applyCta({ ...base, role: "admin" })
    expect(r.kind).toBe("admin")
    expect(r.message).toBe("Vue publique de la mission.")
    expect(r.primary).toBeNull()
  })
  it("lève une erreur sur un id non UUID", () => {
    expect(() => applyCta({ ...base, role: "student", missionId: "abc" })).toThrow()
    expect(() => applyCta({ ...base, role: null, missionId: "../x", accepting: false })).toThrow()
  })
})
