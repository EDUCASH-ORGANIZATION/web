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

describe("libellé de compte clôturé", () => {
  it("publicDisplayName renvoie le libellé intact", () => {
    expect(publicDisplayName("Compte clôturé")).toBe("Compte clôturé")
    expect(publicDisplayName("  Compte   clôturé ")).toBe("Compte clôturé")
    expect(publicDisplayName("Compte clôturé", { full: true })).toBe("Compte clôturé")
  })
  it("firstName renvoie le libellé intact", () => {
    expect(firstName("Compte clôturé")).toBe("Compte clôturé")
    expect(firstName("Compte clôturé", { fallback: "Autre" })).toBe("Compte clôturé")
  })
  it("laisse les autres noms inchangés", () => {
    expect(publicDisplayName("Compte Kossi")).toBe("Compte K.")
    expect(firstName("Compte Kossi")).toBe("Compte")
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
  it("accepte un repli contextuel", () => {
    expect(firstName("", { fallback: "Cet étudiant" })).toBe("Cet étudiant")
    expect(firstName("Awa Dossou", { fallback: "Cet étudiant" })).toBe("Awa")
  })
})
