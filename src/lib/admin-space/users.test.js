import { describe, it, expect } from "vitest"
import {
  detectSearch,
  emailMatches,
  lastPage,
  normalizeSearchPhone,
  pageWindow,
  parseUserId,
  parseUserParams,
  parseUserTab,
  verificationLabel,
} from "./users"

describe("parseUserParams", () => {
  it("applique des valeurs par défaut sûres", () => {
    expect(parseUserParams({})).toEqual({ q: "", role: "", verif: "", statut: "", page: 1 })
    expect(parseUserParams(undefined).page).toBe(1)
  })

  it("ignore les valeurs hors liste", () => {
    const p = parseUserParams({ role: "root", verif: "x", statut: "banni" })
    expect(p).toMatchObject({ role: "", verif: "", statut: "" })
  })

  it("borne la page entre 1 et 1000", () => {
    expect(parseUserParams({ page: "-1" }).page).toBe(1)
    expect(parseUserParams({ page: "0" }).page).toBe(1)
    expect(parseUserParams({ page: "1e9" }).page).toBe(1)
    expect(parseUserParams({ page: "999999999" }).page).toBe(1000)
    expect(parseUserParams({ page: "7" }).page).toBe(7)
    expect(parseUserParams({ page: ["3", "4"] }).page).toBe(3)
  })

  it("tronque et nettoie la recherche", () => {
    expect(parseUserParams({ q: "a".repeat(500) }).q).toHaveLength(80)
    expect(parseUserParams({ q: "  Sèna\u0000  \n Agossou " }).q).toBe("Sèna Agossou")
  })

  it("impose le rôle étudiant avec un filtre de vérification", () => {
    expect(parseUserParams({ verif: "verifie", role: "client" })).toMatchObject({ verif: "verifie", role: "student" })
  })
})

describe("parseUserId et parseUserTab", () => {
  it("n'accepte que des UUID", () => {
    expect(parseUserId("abc")).toBeNull()
    expect(parseUserId("")).toBeNull()
    expect(parseUserId("1 or 1=1")).toBeNull()
    expect(parseUserId("00000000-0000-4000-8000-0000000000AA")).toBe("00000000-0000-4000-8000-0000000000aa")
  })

  it("onglet en liste fermée", () => {
    expect(parseUserTab("missions")).toBe("missions")
    expect(parseUserTab("../etc")).toBe("apercu")
    expect(parseUserTab(undefined)).toBe("apercu")
  })
})

describe("recherche", () => {
  it("normalise un téléphone béninois", () => {
    expect(normalizeSearchPhone("01 97 12 34 56")).toBe("+2290197123456")
    expect(normalizeSearchPhone("+229 01 97 12 34 56")).toBe("+2290197123456")
    expect(normalizeSearchPhone("2290197123456")).toBe("+2290197123456")
    expect(normalizeSearchPhone("Sèna")).toBeNull()
    expect(normalizeSearchPhone("0197")).toBeNull()
  })

  it("détecte e-mail, téléphone, nom et vide", () => {
    expect(detectSearch("")).toEqual({ kind: "none", value: "" })
    expect(detectSearch("Sena.A@Exemple.bj")).toEqual({ kind: "email", value: "sena.a@exemple.bj" })
    expect(detectSearch("0197123456").kind).toBe("phone")
    expect(detectSearch("or=(role.eq.admin)").kind).toBe("name")
  })

  it("correspondance d'e-mail exacte ou préfixe", () => {
    expect(emailMatches("Sena.A@exemple.bj", "sena.a@exemple.bj")).toBe(true)
    expect(emailMatches("sena.a@exemple.bj", "sena")).toBe(true)
    expect(emailMatches("sena.a@exemple.bj", "ena")).toBe(false)
    expect(emailMatches("sena.a@exemple.bj", "")).toBe(false)
  })
})

describe("pagination et libellés", () => {
  it("dernière page", () => {
    expect(lastPage(0)).toBe(1)
    expect(lastPage(20)).toBe(1)
    expect(lastPage(21)).toBe(2)
    expect(lastPage(248)).toBe(13)
  })

  it("fenêtre de pages", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3])
    expect(pageWindow(1, 13)).toEqual([1, 2, "...", 13])
    expect(pageWindow(7, 13)).toEqual([1, "...", 6, 7, 8, "...", 13])
    expect(pageWindow(13, 13)).toEqual([1, "...", 12, 13])
  })

  it("libellé de vérification, vide hors étudiant", () => {
    expect(verificationLabel("client", "verifies")).toBe("")
    expect(verificationLabel("student", "verifies")).toBe("Vérifié")
    expect(verificationLabel("student", "a-examiner")).toBe("En cours d'examen")
    expect(verificationLabel("student", "incomplets")).toBe("Non vérifié")
  })
})
