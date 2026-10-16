import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { compareEntry, defaultOutDir, fileForUrl, parseAssume, resolveInside, validateSpec } from "../../../scripts/fidelity/compare.mjs"

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

  it("affiche tous les codes d'une règle cumulée", () => {
    const result = compareEntry(box(), box({ y: 5 }), { props: ["y"], assume: { y: "A2+A3:5" } })
    expect(result.status).toBe("ASSUMÉ A2, A3")
  })

  it("A8 (élément omis par décision) : accepté dans sa limite, ÉCHEC au-delà, cumul accepté", () => {
    expect(compareEntry(box(), box({ x: 52 }), { props: ["x"], assume: { x: "A8:52" } }).status).toBe("ASSUMÉ A8")
    expect(compareEntry(box(), box({ x: 53 }), { props: ["x"], assume: { x: "A8:52" } }).status).toBe("ÉCHEC")
    expect(compareEntry(box(), box({ w: 112 }), { props: ["w"], assume: { w: "A5+A8:12" } }).status).toBe("ASSUMÉ A5, A8")
  })

  it("A1 : le citron de la planche (rgb 200,240,60) devient celui de la charte (rgb 193,238,62), seul ce couple est accepté", () => {
    const run = (code) => compareEntry({ bg: "rgb(200, 240, 60)" }, { bg: code }, { props: ["bg"], assume: { bg: "A1" } }).status
    expect(run("rgb(193, 238, 62)")).toBe("ASSUMÉ A1")
    expect(run("rgb(193, 238, 63)")).toBe("ÉCHEC")
  })

  it("A9 (texte secondaire 16 px) : accepté dans sa limite, ÉCHEC au-delà, cumul avec A8 accepté", () => {
    const small = box({ fontSize: "14px", h: 20 })
    const big = box({ fontSize: "16px", h: 24 })
    const rules = { fontSize: "A9:2", h: "A9:4" }
    expect(compareEntry(small, big, { props: ["fontSize", "h"], assume: rules }).status).toBe("ASSUMÉ A9")
    expect(compareEntry(small, box({ fontSize: "17px", h: 24 }), { props: ["fontSize", "h"], assume: rules }).status).toBe("ÉCHEC")
    expect(compareEntry(small, box({ fontSize: "16px", h: 25 }), { props: ["fontSize", "h"], assume: rules }).status).toBe("ÉCHEC")
    expect(compareEntry(small, box({ fontSize: "16px", h: 30 }), { props: ["fontSize", "h"], assume: { fontSize: "A9:2", h: "A8+A9:10" } }).status).toBe("ASSUMÉ A8, A9")
  })

  it("X1 donne un statut distinct, jamais ASSUMÉ", () => {
    const result = compareEntry(box(), box({ y: 4 }), { props: ["y"], assume: { y: "A3+X1:4" } })
    expect(result.status).toBe("NON EXPLIQUÉ A3, X1")
  })

  it("cumul A2+A3+X1:5 : 5 accepté, 6 refusé", () => {
    const rule = { y: "A2+A3+X1:5" }
    expect(compareEntry(box(), box({ y: 5 }), { props: ["y"], assume: rule }).status).toBe("NON EXPLIQUÉ A2, A3, X1")
    expect(compareEntry(box(), box({ y: 6 }), { props: ["y"], assume: rule }).status).toBe("ÉCHEC")
  })

  it("la limite exacte est respectée : +4 hors de A3:3", () => {
    const result = compareEntry(box(), box({ y: 4 }), { props: ["y"], assume: { y: "A3:3" } })
    expect(result.status).toBe("ÉCHEC")
  })
})

describe("compareEntry : rognage par un ancêtre", () => {
  it("une boîte identique mais rognée est en ÉCHEC avec l'ancêtre nommé, jamais OK", () => {
    const result = compareEntry(box(), box({ clippedBy: "div.thread" }), { props: ["x", "y", "w", "h"] })
    expect(result.status).toBe("ÉCHEC")
    expect(result.note).toBe("rogné par div.thread")
  })

  it("un écart assumé n'efface pas le rognage", () => {
    const result = compareEntry(box(), box({ y: 3, clippedBy: "main.shell" }), { props: ["y"], assume: { y: "A3:3" } })
    expect(result.status).toBe("ÉCHEC")
    expect(result.note).toBe("rogné par main.shell")
  })

  it("un écart non assumé garde son détail et ajoute le rognage", () => {
    const result = compareEntry(box(), box({ w: 120, clippedBy: "div.thread" }), { props: ["w"] })
    expect(result.status).toBe("ÉCHEC")
    expect(result.note).toBe("rogné par div.thread")
    expect(result.diffs[0].label).toBe("w+20")
  })

  it("sans rognage (null ou absent), le statut reste celui des écarts", () => {
    expect(compareEntry(box(), box({ clippedBy: null }), { props: ["x"] }).status).toBe("OK")
    expect(compareEntry(box(), box(), { props: ["x"] }).status).toBe("OK")
  })
})

describe("defaultOutDir", () => {
  it("un dossier par dépôt : deux chemins différents, deux dossiers", () => {
    expect(defaultOutDir("/a/web-ST08")).not.toBe(defaultOutDir("/a/web-ST09"))
  })

  it("stable : même chemin, même dossier (barre finale ou segments relatifs inclus)", () => {
    expect(defaultOutDir("/a/web-ST08")).toBe(defaultOutDir("/a/web-ST08"))
    expect(defaultOutDir("/a/web-ST08")).toBe(defaultOutDir("/a/web-ST08/"))
    expect(defaultOutDir("/a/b/../web-ST08")).toBe(defaultOutDir("/a/web-ST08"))
  })

  it("sous /tmp/educash-fidelity, avec un hash hexadécimal court", () => {
    expect(defaultOutDir("/a/web")).toMatch(/^\/tmp\/educash-fidelity\/[0-9a-f]{10}$/)
  })
})

describe("parseAssume", () => {
  it("refuse un code hors liste blanche", () => {
    expect(() => parseAssume("A10:100", "y")).toThrow(/inconnue/)
    expect(() => parseAssume("Z", "color")).toThrow(/inconnue/)
  })

  it("refuse limite vide, code vide, A1 cumulé ou hors couleur", () => {
    expect(() => parseAssume("A3:", "y")).toThrow(/invalide/)
    expect(() => parseAssume("+A3:2", "y")).toThrow(/invalide/)
    expect(() => parseAssume("A3+:2", "y")).toThrow(/invalide/)
    expect(() => parseAssume("A1+A3", "color")).toThrow(/ne se cumule pas/)
    expect(() => parseAssume("A1", "fontFamily")).toThrow(/couleurs/)
    expect(parseAssume("A1", "bg").names).toEqual(["A1"])
  })

  it("POLICE : seulement w et tw, limite obligatoire", () => {
    expect(parseAssume("POLICE:5", "tw").names).toEqual(["POLICE"])
    expect(() => parseAssume("POLICE:5", "y")).toThrow(/limité à w et tw/)
    expect(() => parseAssume("POLICE", "w")).toThrow(/limite/)
  })

  it("A8 exige une limite quel que soit le type de propriété", () => {
    expect(() => parseAssume("A8", "bg")).toThrow(/A8 exige une limite/)
    expect(() => parseAssume("A8", "x")).toThrow()
    expect(() => parseAssume("A8:", "x")).toThrow()
  })

  it("BANC : limité à h, y, pad, limite obligatoire, hors limite ÉCHEC", () => {
    expect(parseAssume("BANC:24", "h").max).toBe(24)
    expect(() => parseAssume("BANC:24", "bg")).toThrow(/limité/)
    expect(() => parseAssume("BANC", "h")).toThrow()
    expect(compareEntry(box({ h: 89 }), box({ h: 65 }), { props: ["h"], assume: { h: "BANC:24" } }).status).toBe("ASSUMÉ BANC")
    expect(compareEntry(box({ h: 89 }), box({ h: 64 }), { props: ["h"], assume: { h: "BANC:24" } }).status).toBe("ÉCHEC")
  })

  it("A9 : limité à fontSize, h, w, tw, limite obligatoire, cumulable avec A8", () => {
    expect(parseAssume("A9:2", "fontSize").names).toEqual(["A9"])
    expect(parseAssume("A8+A9:12", "h").names).toEqual(["A8", "A9"])
    expect(() => parseAssume("A9", "fontSize")).toThrow(/A9 exige une limite/)
    expect(() => parseAssume("A9:2", "y")).toThrow(/limité à fontSize/)
    expect(() => parseAssume("A9:2", "color")).toThrow(/limité à fontSize/)
    expect(() => parseAssume("A9", "bg")).toThrow(/A9 exige une limite/)
  })

  it("limite obligatoire pour une propriété numérique", () => {
    expect(() => parseAssume("A3", "y")).toThrow(/obligatoire/)
    expect(parseAssume("A1", "color").max).toBeNull()
  })
})

describe("validateSpec", () => {
  const spec = (selector, extra = {}) => ({ id: "T", views: [{ name: "v", selectors: [selector] }], ...extra })

  it("A8 sans note est refusé, avec note accepté", () => {
    expect(() => validateSpec(spec({ id: "X", label: "a", assume: { x: "A8:52" } }))).toThrow(/sans note/)
    expect(validateSpec(spec({ id: "X", label: "a", assume: { x: "A8:52" }, note: "menu omis" }))).toBeTruthy()
  })

  it("refuse une règle Ax:n sans note", () => {
    expect(() => validateSpec(spec({ id: "X", label: "a", assume: { h: "A2:4" } }))).toThrow(/sans note/)
  })

  it("accepte la règle avec note, et refuse une règle inconnue", () => {
    expect(validateSpec(spec({ id: "X", label: "a", assume: { h: "A2:4" }, note: "A2 : +3 mesuré" }))).toBeTruthy()
    expect(() => validateSpec(spec({ id: "X", label: "a", assume: { h: "A10:4" }, note: "n" }))).toThrow(/inconnue/)
  })

  it("A9 : sans note refusé, avec note accepté, sur une couleur refusé", () => {
    expect(() => validateSpec(spec({ id: "X", label: "a", assume: { fontSize: "A9:2" } }))).toThrow(/sans note/)
    expect(validateSpec(spec({ id: "X", label: "a", assume: { fontSize: "A9:2" }, note: "16 px, RD-FIX-03" }))).toBeTruthy()
    expect(() => validateSpec(spec({ id: "X", label: "a", assume: { color: "A9:2" }, note: "n" }))).toThrow(/limité à fontSize/)
    expect(() => validateSpec(spec({ id: "X", label: "a", assume: { bg: "A9" }, note: "n" }))).toThrow(/A9 exige une limite/)
  })

  it("règle de spécification : exige assumeNote", () => {
    expect(() => validateSpec(spec({ id: "X", label: "a" }, { assume: { fontSize: "A2:1" } }))).toThrow(/sans note/)
    expect(validateSpec(spec({ id: "X", label: "a" }, { assume: { fontSize: "A2:1" }, assumeNote: "A2" }))).toBeTruthy()
  })
})

const tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), "fidelity-test-")))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))
const pub = path.join(tmp, "pub")
const maq = path.join(tmp, "maq")
mkdirSync(path.join(pub, "a"), { recursive: true })
mkdirSync(path.join(maq, "etudiant"), { recursive: true })
writeFileSync(path.join(pub, "a/b.css"), "")
writeFileSync(path.join(pub, "logo.svg"), "")
writeFileSync(path.join(maq, "etudiant/E06.html"), "")

describe("fileForUrl", () => {
  const dirs = { out: "/tmp/out", maquettes: maq, publicDir: pub }

  it("sert les chemins sous leur racine", () => {
    expect(fileForUrl(dirs, "/maquettes/etudiant/E06.html?x=1")).toBe(path.join(maq, "etudiant/E06.html"))
    expect(fileForUrl(dirs, "/app.css")).toBe("/tmp/out/app.css")
    expect(fileForUrl(dirs, "/logo.svg")).toBe(path.join(pub, "logo.svg"))
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
    mkdirSync(path.join(tmp, "pub-evil"), { recursive: true })
    expect(resolveInside(pub, "/a/b.css")).toBe(path.join(pub, "a/b.css"))
    expect(resolveInside(pub, "/../pub-evil/x")).toBeNull()
  })

  it("renvoie le chemin réel d'un lien interne à la racine", () => {
    symlinkSync(path.join(pub, "a"), path.join(pub, "inner"))
    expect(resolveInside(pub, "/inner/b.css")).toBe(path.join(pub, "a/b.css"))
  })

  it("refuse un lien symbolique pointant hors de la racine, et un fichier absent", () => {
    const outside = path.join(tmp, "outside")
    mkdirSync(outside, { recursive: true })
    writeFileSync(path.join(outside, "secret.txt"), "x")
    symlinkSync(outside, path.join(pub, "link"))
    symlinkSync(path.join(outside, "secret.txt"), path.join(pub, "file-link"))
    expect(resolveInside(pub, "/link/secret.txt")).toBeNull()
    expect(resolveInside(pub, "/file-link")).toBeNull()
    expect(resolveInside(pub, "/absent.css")).toBeNull()
  })
})
