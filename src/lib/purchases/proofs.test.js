import { describe, it, expect } from "vitest"
import {
  PROOF_BUCKET,
  PROOF_MAX_BYTES,
  PROOF_KINDS,
  PROOF_SIGNED_URL_SECONDS,
  isUuid,
  proofExtensionOf,
  validateProofFile,
  proofPath,
  isOwnedProofPath,
} from "./proofs.js"

const OWNER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const REQUEST = "33333333-3333-4333-8333-333333333333"
const TOKEN = "a1b2c3d4e5"

describe("constantes des preuves", () => {
  it("compartiment privé, 10 Mo, URL signée de 120 s", () => {
    expect(PROOF_BUCKET).toBe("purchase-proofs")
    expect(PROOF_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(PROOF_SIGNED_URL_SECONDS).toBe(120)
  })

  it("l'étudiant dépose le numéro et le ticket, le client la capture du SMS", () => {
    expect(PROOF_KINDS).toEqual({ payee: "student", ticket: "student", sms: "client" })
  })
})

describe("isUuid", () => {
  it.each([OWNER, REQUEST.toUpperCase()])("accepte %s", (value) => expect(isUuid(value)).toBe(true))
  it.each([undefined, null, 12, "", "abc", `${OWNER}x`, `../${OWNER}`, OWNER.replace(/-/g, ""), {}, [OWNER]])(
    "refuse %j",
    (value) => expect(isUuid(value)).toBe(false),
  )
})

describe("proofExtensionOf", () => {
  it.each([
    ["panneau.JPG", "jpg"],
    ["photo.jpeg", "jpeg"],
    ["a.b.png", "png"],
    ["ticket.WebP", "webp"],
    ["IMG_0001.HEIC", "heic"],
    ["x.heif", "heif"],
  ])("%s -> %s", (name, ext) => expect(proofExtensionOf(name)).toBe(ext))

  it.each(["", "photo", "photo.gif", "photo.svg", "photo.pdf", "photo.jpg.exe", ".", null, 5])("refuse %j", (name) => {
    expect(proofExtensionOf(name)).toBeNull()
  })

  it("ignore les espaces autour du nom", () => {
    expect(proofExtensionOf("photo.jpg ")).toBe("jpg")
  })
})

describe("validateProofFile", () => {
  it("accepte une photo valide et renvoie l'extension", () => {
    expect(validateProofFile({ name: "a.JPG", type: "image/jpeg", size: 1234 })).toEqual({ ok: true, extension: "jpg" })
  })

  it("accepte exactement 10 Mo et refuse un octet de plus", () => {
    expect(validateProofFile({ name: "a.png", type: "image/png", size: PROOF_MAX_BYTES }).ok).toBe(true)
    const big = validateProofFile({ name: "a.png", type: "image/png", size: PROOF_MAX_BYTES + 1 })
    expect(big.ok).toBe(false)
    expect(big.error).toContain("10 Mo")
  })

  it.each([0, -1, NaN, Infinity, "gros", undefined])("refuse la taille %j", (size) => {
    expect(validateProofFile({ name: "a.png", type: "image/png", size }).ok).toBe(false)
  })

  it("refuse une extension ou un type hors liste", () => {
    expect(validateProofFile({ name: "a.gif", type: "image/gif", size: 10 }).ok).toBe(false)
    expect(validateProofFile({ name: "a.jpg", type: "image/svg+xml", size: 10 }).ok).toBe(false)
    expect(validateProofFile({ name: "a.jpg", type: "text/html", size: 10 }).ok).toBe(false)
    expect(validateProofFile({ name: "a.jpg", type: "application/pdf", size: 10 }).ok).toBe(false)
  })

  it("tolère un type MIME vide quand l'extension est acceptée (HEIC)", () => {
    expect(validateProofFile({ name: "a.heic", type: "", size: 10 }).ok).toBe(true)
    expect(validateProofFile({ name: "a.exe", type: "", size: 10 }).ok).toBe(false)
  })

  it("ne plante pas sans fichier", () => {
    expect(validateProofFile(undefined).ok).toBe(false)
    expect(validateProofFile(null).ok).toBe(false)
  })

  it("les messages d'erreur sont vouvoyés", () => {
    for (const file of [{ size: 0 }, { name: "a.png", type: "image/png", size: PROOF_MAX_BYTES + 1 }, { name: "a.gif", size: 1 }]) {
      const result = validateProofFile(file)
      expect(result.error).toMatch(/Choisissez|Utilisez/)
    }
  })
})

describe("proofPath", () => {
  it("construit <déposant>/<demande>/<nature>-<jeton>.<extension>", () => {
    expect(proofPath({ ownerId: OWNER, requestId: REQUEST, kind: "payee", extension: "jpg", token: TOKEN })).toBe(
      `${OWNER}/${REQUEST}/payee-${TOKEN}.jpg`,
    )
  })

  it("met les identifiants en minuscules", () => {
    expect(
      proofPath({ ownerId: OWNER.toUpperCase(), requestId: REQUEST.toUpperCase(), kind: "sms", extension: "png", token: TOKEN }),
    ).toBe(`${OWNER}/${REQUEST}/sms-${TOKEN}.png`)
  })

  it.each([
    ["déposant forgé", { ownerId: "../x" }],
    ["demande forgée", { requestId: `${REQUEST}/../..` }],
    ["nature inconnue", { kind: "admin" }],
    ["nature héritée", { kind: "constructor" }],
    ["extension refusée", { extension: "exe" }],
    ["extension avec point", { extension: ".jpg" }],
    ["jeton trop court", { token: "abc" }],
    ["jeton avec barre", { token: "a/../b1234567" }],
    ["jeton en majuscules", { token: "ABCDEFGH12" }],
    ["jeton trop long", { token: "a".repeat(41) }],
  ])("renvoie null : %s", (_name, override) => {
    expect(proofPath({ ownerId: OWNER, requestId: REQUEST, kind: "ticket", extension: "jpg", token: TOKEN, ...override })).toBeNull()
  })

  it("renvoie null sans paramètres", () => {
    expect(proofPath()).toBeNull()
  })
})

describe("isOwnedProofPath", () => {
  const good = `${OWNER}/${REQUEST}/ticket-${TOKEN}.webp`

  it("accepte un chemin du déposant et de la demande", () => {
    expect(isOwnedProofPath(good, { ownerId: OWNER, requestId: REQUEST })).toBe(true)
    expect(isOwnedProofPath(good, { ownerId: OWNER.toUpperCase(), requestId: REQUEST, kind: "ticket" })).toBe(true)
  })

  it("exige la nature attendue quand elle est donnée", () => {
    expect(isOwnedProofPath(good, { ownerId: OWNER, requestId: REQUEST, kind: "payee" })).toBe(false)
    expect(isOwnedProofPath(good, { ownerId: OWNER, requestId: REQUEST, kind: "sms" })).toBe(false)
  })

  it("refuse le dossier d'un autre déposant ou d'une autre demande", () => {
    expect(isOwnedProofPath(good, { ownerId: OTHER, requestId: REQUEST })).toBe(false)
    expect(isOwnedProofPath(good, { ownerId: OWNER, requestId: OTHER })).toBe(false)
  })

  it.each([
    ["traversée", `${OWNER}/${REQUEST}/../${OTHER}/ticket-${TOKEN}.jpg`],
    ["traversée dans le nom", `${OWNER}/${REQUEST}/ticket-..%2F${TOKEN}.jpg`],
    ["barre oblique initiale", `/${OWNER}/${REQUEST}/ticket-${TOKEN}.jpg`],
    ["barre doublée", `${OWNER}//${REQUEST}/ticket-${TOKEN}.jpg`],
    ["barre inverse", `${OWNER}\\${REQUEST}\\ticket-${TOKEN}.jpg`],
    ["sous-dossier en trop", `${OWNER}/${REQUEST}/x/ticket-${TOKEN}.jpg`],
    ["extension refusée", `${OWNER}/${REQUEST}/ticket-${TOKEN}.svg`],
    ["double extension", `${OWNER}/${REQUEST}/ticket-${TOKEN}.jpg.html`],
    ["nature inconnue", `${OWNER}/${REQUEST}/avatar-${TOKEN}.jpg`],
    ["octet nul", `${OWNER}/${REQUEST}/ticket-${TOKEN}.jpg\u0000.png`],
    ["retour à la ligne", `${OWNER}/${REQUEST}/ticket-${TOKEN}.jpg\n`],
    ["vide", ""],
    ["objet", {}],
    ["nul", null],
  ])("refuse : %s", (_name, path) => {
    expect(isOwnedProofPath(path, { ownerId: OWNER, requestId: REQUEST })).toBe(false)
  })

  it("refuse si le déposant ou la demande attendus sont invalides", () => {
    expect(isOwnedProofPath(good, { ownerId: "x", requestId: REQUEST })).toBe(false)
    expect(isOwnedProofPath(good)).toBe(false)
  })

  it("accepte tout chemin produit par proofPath", () => {
    for (const kind of Object.keys(PROOF_KINDS)) {
      const path = proofPath({ ownerId: OWNER, requestId: REQUEST, kind, extension: "heic", token: TOKEN })
      expect(isOwnedProofPath(path, { ownerId: OWNER, requestId: REQUEST, kind })).toBe(true)
    }
  })
})
