import { describe, it, expect } from "vitest"
import { PUBLISH_PATH, PUBLISH_RESUME_KEY, parsePublishPrefill, publishHref, resumePublishHref } from "./publish-prefill.js"

describe("parsePublishPrefill", () => {
  it("lit besoin, ville et type valides", () => {
    expect(
      parsePublishPrefill({ besoin: "Faire le marché", ville: "Porto-Novo", type: "Livraison" }),
    ).toEqual({ title: "Faire le marché", city: "Porto-Novo", type: "Livraison" })
  })
  it("rejette une ville et un type hors liste", () => {
    expect(parsePublishPrefill({ ville: "Paris", type: "Piratage" })).toEqual({
      title: "",
      city: "",
      type: "",
    })
  })
  it("tronque le titre à 80 caractères", () => {
    expect(parsePublishPrefill({ besoin: "a".repeat(200) }).title).toHaveLength(80)
  })
  it("tronque par points de code sans couper un emoji", () => {
    const title = parsePublishPrefill({ besoin: "😀".repeat(100) }).title
    expect(Array.from(title)).toHaveLength(80)
    expect(title).toBe("😀".repeat(80))
  })
  it("retire les caractères de format invisibles", () => {
    expect(parsePublishPrefill({ besoin: "Ga\u200brde\u200f \u202eli\u202ast" }).title).toBe("Garde list")
  })
  it("prend le premier élément d'un tableau", () => {
    expect(parsePublishPrefill({ besoin: ["un", "deux"], ville: ["Cotonou", "Porto-Novo"] })).toEqual({
      title: "un",
      city: "Cotonou",
      type: "",
    })
  })
  it("retire les caractères de contrôle et rogne les espaces", () => {
    expect(parsePublishPrefill({ besoin: "  Gar\u0000de\n  " }).title).toBe("Garde")
  })
  it("tolère des paramètres absents ou non textuels", () => {
    expect(parsePublishPrefill(undefined)).toEqual({ title: "", city: "", type: "" })
    expect(parsePublishPrefill({ besoin: 42, ville: [] })).toEqual({ title: "", city: "", type: "" })
  })
})

describe("publishHref", () => {
  it("renvoie le chemin seul sans paramètre", () => {
    expect(publishHref()).toBe(PUBLISH_PATH)
    expect(publishHref({ besoin: "", ville: "", type: "" })).toBe("/client/missions/new")
  })
  it("omet les paramètres vides et encode les valeurs", () => {
    expect(publishHref({ type: "Cours particuliers" })).toBe("/client/missions/new?type=Cours+particuliers")
    expect(publishHref({ besoin: "Faire le marché", ville: "Cotonou" })).toBe(
      "/client/missions/new?besoin=Faire+le+march%C3%A9&ville=Cotonou",
    )
  })
  it("reste une URL relative interne", () => {
    expect(publishHref({ besoin: "//evil.com" }).startsWith("/client/missions/new")).toBe(true)
  })
  it("fait un aller-retour cohérent avec parsePublishPrefill", () => {
    const href = publishHref({ besoin: "Faire le marché", ville: "Porto-Novo", type: "Démarches" })
    const params = Object.fromEntries(new URL(href, "http://x").searchParams)
    expect(parsePublishPrefill(params)).toEqual({
      title: "Faire le marché",
      city: "Porto-Novo",
      type: "Démarches",
    })
  })
})

describe("resumePublishHref", () => {
  it("accepte la page de publication avec son pré-remplissage", () => {
    expect(resumePublishHref("/client/missions/new?besoin=Repas&ville=Cotonou")).toBe(
      "/client/missions/new?besoin=Repas&ville=Cotonou",
    )
    expect(resumePublishHref(PUBLISH_PATH)).toBe(PUBLISH_PATH)
  })
  it("refuse les redirections ouvertes et les autres chemins", () => {
    for (const bad of [
      "//evil",
      "https://evil.test/client/missions/new",
      "/client/wallet",
      "/auth/login?next=/client/missions/new",
      "/client/missions/newest",
      "/client/missions/new/../../x",
      "/\\evil",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(resumePublishHref(bad)).toBeNull()
    }
  })
  it("expose la clé de stockage", () => {
    expect(PUBLISH_RESUME_KEY).toBe("ec_publish_resume")
  })
})
