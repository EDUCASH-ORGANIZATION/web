import path from "node:path"
import { describe, expect, it } from "vitest"
import { compareEntry, fileForUrl, resolveInside } from "../../../scripts/fidelity/compare.mjs"

const box = (over = {}) => ({ x: 0, y: 0, w: 100, h: 20, tw: 80, fontSize: "14px", ...over })

describe("compareEntry", () => {
  it("OK quand tout est dans la tolérance", () => {
    const result = compareEntry(box(), box({ y: 1 }), { props: ["x", "y", "w", "tw"] })
    expect(result.status).toBe("OK")
  })

  it("compare la largeur du texte : un écart de 16 px n'est plus OK", () => {
    const result = compareEntry(box({ tw: 167 }), box({ tw: 151 }), { props: ["tw"] })
    expect(result.status).toBe("ÉCHEC")
    expect(result.diffs[0].label).toBe("tw-16")
  })

  it("accepte un écart de police sous un statut distinct", () => {
    const result = compareEntry(box({ tw: 167 }), box({ tw: 151 }), { props: ["tw"], assume: { tw: "POLICE:17" } })
    expect(result.status).toBe("ASSUMÉ-POLICE")
  })

  it("refuse un écart supérieur au maximum assumé", () => {
    const result = compareEntry(box({ y: 0 }), box({ y: 5 }), { props: ["y"], assume: { y: "A3:4" } })
    expect(result.status).toBe("ÉCHEC")
  })

  it("mélange de règles : liste les codes", () => {
    const result = compareEntry(box(), box({ y: 4, tw: 70 }), { props: ["y", "tw"], assume: { y: "A3:5", tw: "POLICE:11" } })
    expect(result.status).toBe("ASSUMÉ A3, POLICE")
  })
})

describe("fileForUrl", () => {
  const dirs = { out: "/tmp/out", maquettes: "/tmp/maq", publicDir: "/tmp/pub" }

  it("sert les chemins sous leur racine", () => {
    expect(fileForUrl(dirs, "/maquettes/etudiant/E06.html?x=1")).toBe(path.join("/tmp/maq", "etudiant/E06.html"))
    expect(fileForUrl(dirs, "/app.css")).toBe("/tmp/out/app.css")
    expect(fileForUrl(dirs, "/logo.svg")).toBe("/tmp/pub/logo.svg")
  })

  it("refuse la traversée de dossier, encodée ou non", () => {
    expect(fileForUrl(dirs, "/maquettes/../../etc/passwd")).toBeNull()
    expect(fileForUrl(dirs, "/maquettes/%2e%2e/%2e%2e/etc/passwd")).toBeNull()
    expect(fileForUrl(dirs, "/screens/../../etc/passwd")).toBeNull()
    expect(fileForUrl(dirs, "/../secret")).toBeNull()
  })

  it("refuse une URL mal encodée ou avec octet nul sans lever d'exception", () => {
    expect(fileForUrl(dirs, "/maquettes/%E0%A4%A")).toBeNull()
    expect(fileForUrl(dirs, "/logo.svg%00.png")).toBeNull()
  })
})

describe("resolveInside", () => {
  it("accepte un sous-chemin et refuse le préfixe frère", () => {
    expect(resolveInside("/tmp/pub", "/a/b.css")).toBe("/tmp/pub/a/b.css")
    expect(resolveInside("/tmp/pub", "/../pub-evil/x")).toBeNull()
  })
})
