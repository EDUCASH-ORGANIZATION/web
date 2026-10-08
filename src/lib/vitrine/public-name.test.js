import { describe, it, expect } from "vitest"
import { publicDisplayName, firstName } from "./public-name"

describe("publicDisplayName", () => {
  it("abrège le dernier mot", () => {
    expect(publicDisplayName("Sèna Kossi Ahouandjinou")).toBe("Sèna A.")
  })
  it("garde un mot seul", () => {
    expect(publicDisplayName("sèna")).toBe("sèna")
  })
  it("tolère les espaces multiples", () => {
    expect(publicDisplayName("  Sèna    Kossi  ")).toBe("Sèna K.")
  })
  it("renvoie la valeur par défaut", () => {
    expect(publicDisplayName(null)).toBe("Étudiant EduCash")
    expect(publicDisplayName("")).toBe("Étudiant EduCash")
    expect(publicDisplayName("   ")).toBe("Étudiant EduCash")
  })
  it("gère les noms composés et particules", () => {
    expect(publicDisplayName("Jean-Marc de Souza")).toBe("Jean-Marc S.")
  })
  it("met l'initiale accentuée en majuscule", () => {
    expect(publicDisplayName("Ama édith")).toBe("Ama É.")
  })
  it("renvoie le nom nettoyé avec full", () => {
    expect(publicDisplayName("  Sèna   Kossi  Ahouandjinou ", { full: true })).toBe(
      "Sèna Kossi Ahouandjinou"
    )
    expect(publicDisplayName(null, { full: true })).toBe("Étudiant EduCash")
  })
})

describe("firstName", () => {
  it("renvoie le premier mot", () => {
    expect(firstName("Awa  Dossou")).toBe("Awa")
  })
  it("renvoie Client par défaut", () => {
    expect(firstName("")).toBe("Client")
    expect(firstName(null)).toBe("Client")
    expect(firstName(undefined)).toBe("Client")
  })
})
