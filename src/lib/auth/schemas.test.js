import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import {
  PASSWORD_RULES,
  STUDY_LEVELS,
  AVAILABILITY_PRESETS,
  makeLoginSchema,
  makeRegisterSchema,
  makeForgotSchema,
  makeResetSchema,
  makeResendSchema,
  loginSchema,
  forgotSchema,
  resendSchema,
  resetSchema,
  studentIdentitySchema,
  studentStudiesSchema,
  clientTypeSchema,
  clientIdentitySchema,
  parseFormData,
} from "./schemas.js"

const STRONG = "Abcdef1!"

function form(values) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v))
    else fd.append(key, value)
  }
  return fd
}

const validRegister = {
  role: "student",
  email: "sena@example.com",
  password: STRONG,
  confirmPassword: STRONG,
  cgu: "on",
}

describe("PASSWORD_RULES", () => {
  it("compte les 5 règles actuelles", () => {
    expect(PASSWORD_RULES.map((r) => r.key)).toEqual(["length", "uppercase", "lowercase", "number", "special"])
    expect(PASSWORD_RULES.every((r) => r.test(STRONG))).toBe(true)
    expect(PASSWORD_RULES.filter((r) => r.test("abc")).map((r) => r.key)).toEqual(["lowercase"])
  })
})

describe("makeRegisterSchema", () => {
  it.each(["student", "client"])("accepte le rôle %s", (role) => {
    const result = parseFormData(makeRegisterSchema(role), form({ ...validRegister, role }))
    expect(result.ok).toBe(true)
    expect(result.data.role).toBe(role)
    expect(result.data.cgu).toBe(true)
  })

  it.each([["admin"], ["superadmin"], [""], ["Student"]])("refuse le rôle %j avec un message lisible", (role) => {
    const result = parseFormData(makeRegisterSchema("student"), form({ ...validRegister, role }))
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.role).toBe("Choisis si tu es étudiant ou client.")
  })

  it("refuse l'absence de rôle", () => {
    const { role, ...rest } = validRegister
    const result = parseFormData(makeRegisterSchema("client"), form(rest))
    expect(result.fieldErrors.role).toBe("Choisissez si vous êtes étudiant ou client.")
  })

  it("exige la case des conditions", () => {
    const { cgu, ...rest } = validRegister
    const result = parseFormData(makeRegisterSchema("student"), form(rest))
    expect(result.fieldErrors.cgu).toMatch(/Accepte/)
    const off = parseFormData(makeRegisterSchema("student"), form({ ...validRegister, cgu: "off" }))
    expect(off.fieldErrors.cgu).toBeDefined()
  })

  it("exige une confirmation identique", () => {
    const result = parseFormData(makeRegisterSchema("student"), form({ ...validRegister, confirmPassword: "Autre1!aa" }))
    expect(result.fieldErrors).toEqual({ confirmPassword: "Les deux mots de passe ne sont pas identiques." })
  })

  it("exige une confirmation renseignée", () => {
    const result = parseFormData(makeRegisterSchema("client"), form({ ...validRegister, confirmPassword: "" }))
    expect(result.fieldErrors.confirmPassword).toBe("Confirmez votre mot de passe.")
  })

  it.each(["abc", "abcdefgh", "ABCDEFG1!", "Abcdefgh1", "Ab1!"])("refuse le mot de passe faible %j", (password) => {
    const result = parseFormData(
      makeRegisterSchema("student"),
      form({ ...validRegister, password, confirmPassword: password })
    )
    expect(result.fieldErrors.password).toMatch(/règles/)
  })

  it("refuse un email jetable et un email invalide", () => {
    const disposable = parseFormData(makeRegisterSchema("student"), form({ ...validRegister, email: "x@Mailinator.com" }))
    expect(disposable.fieldErrors.email).toMatch(/jetables/)
    const invalid = parseFormData(makeRegisterSchema("student"), form({ ...validRegister, email: "pas-un-email" }))
    expect(invalid.fieldErrors.email).toBe("Cette adresse email n'est pas valide.")
  })

  it("refuse un email de plus de 254 caractères", () => {
    const long = `${"a".repeat(250)}@example.com`
    const result = parseFormData(makeRegisterSchema("student"), form({ ...validRegister, email: long }))
    expect(result.fieldErrors.email).toMatch(/254/)
  })

  it("coupe les espaces autour de l'email", () => {
    const result = parseFormData(makeRegisterSchema("student"), form({ ...validRegister, email: "  sena@example.com " }))
    expect(result.data.email).toBe("sena@example.com")
  })
})

describe("messages par audience", () => {
  const empty = form({})

  it("tutoie l'étudiant", () => {
    const { fieldErrors } = parseFormData(makeLoginSchema("student"), empty)
    expect(fieldErrors).toEqual({ email: "Saisis ton adresse email.", password: "Saisis ton mot de passe." })
  })

  it("vouvoie le client et les écrans neutres", () => {
    const expected = { email: "Saisissez votre adresse email.", password: "Saisissez votre mot de passe." }
    expect(parseFormData(makeLoginSchema("client"), empty).fieldErrors).toEqual(expected)
    expect(parseFormData(loginSchema, empty).fieldErrors).toEqual(expected)
  })

  it("n'emploie pas « vous » côté étudiant ni « tu » côté client", () => {
    const student = parseFormData(makeRegisterSchema("student"), empty).fieldErrors
    const client = parseFormData(makeRegisterSchema("client"), empty).fieldErrors
    expect(Object.values(student).join(" ")).not.toMatch(/(?<!\p{L})(vous|votre|vos)(?!\p{L})/iu)
    expect(Object.values(client).join(" ")).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes)(?!\p{L})/iu)
  })
})

describe("loginSchema", () => {
  it("n'applique aucune règle de complexité", () => {
    const result = parseFormData(loginSchema, form({ email: "a@example.com", password: "x" }))
    expect(result.ok).toBe(true)
  })

  it("accepte un domaine jetable (compte existant) mais exige email et mot de passe", () => {
    expect(parseFormData(loginSchema, form({ email: "a@mailinator.com", password: "x" })).ok).toBe(true)
    expect(parseFormData(loginSchema, form({ email: "", password: "" })).ok).toBe(false)
  })
})

describe("forgotSchema, resendSchema, resetSchema", () => {
  it("valident l'email", () => {
    expect(parseFormData(forgotSchema, form({ email: "a@example.com" })).ok).toBe(true)
    expect(parseFormData(makeForgotSchema("student"), form({ email: "nope" })).fieldErrors.email).toBeDefined()
    expect(parseFormData(resendSchema, form({ email: "a@example.com" })).ok).toBe(true)
    expect(parseFormData(makeResendSchema("student"), form({ email: "" })).fieldErrors.email).toMatch(/Saisis/)
  })

  it("reset : règles et confirmation", () => {
    expect(parseFormData(resetSchema, form({ password: STRONG, confirmPassword: STRONG })).ok).toBe(true)
    expect(parseFormData(resetSchema, form({ password: "abc", confirmPassword: "abc" })).fieldErrors.password).toBeDefined()
    expect(
      parseFormData(makeResetSchema("student"), form({ password: STRONG, confirmPassword: "Zzzzzz1!" })).fieldErrors.confirmPassword
    ).toBeDefined()
  })
})

describe("studentIdentitySchema", () => {
  const valid = { fullName: "Sèna Agossou", city: "Abomey-Calavi", phone: "01 97 45 21 08", bio: "" }

  it("accepte et normalise le téléphone en E.164", () => {
    const result = parseFormData(studentIdentitySchema, form(valid))
    expect(result.ok).toBe(true)
    expect(result.data.phone).toBe("+2290197452108")
    expect(result.data.bio).toBe("")
  })

  it("bio facultative, 200 caractères au plus", () => {
    const { bio, ...rest } = valid
    expect(parseFormData(studentIdentitySchema, form(rest)).ok).toBe(true)
    expect(parseFormData(studentIdentitySchema, form({ ...valid, bio: "x".repeat(201) })).fieldErrors.bio).toMatch(/200/)
    expect(parseFormData(studentIdentitySchema, form({ ...valid, bio: "x".repeat(200) })).ok).toBe(true)
  })

  it("refuse nom trop court, trop long ou sans lettre", () => {
    expect(parseFormData(studentIdentitySchema, form({ ...valid, fullName: "S" })).fieldErrors.fullName).toBeDefined()
    expect(parseFormData(studentIdentitySchema, form({ ...valid, fullName: "x".repeat(81) })).fieldErrors.fullName).toBeDefined()
    expect(parseFormData(studentIdentitySchema, form({ ...valid, fullName: "1234" })).fieldErrors.fullName).toMatch(/lettre/)
    expect(parseFormData(studentIdentitySchema, form({ ...valid, fullName: "" })).fieldErrors.fullName).toBe("Saisis ton nom et ton prénom.")
  })

  it("refuse une ville hors CITIES et un téléphone invalide, avec messages tutoyés", () => {
    const result = parseFormData(studentIdentitySchema, form({ ...valid, city: "Paris", phone: "97 45 21" }))
    expect(result.fieldErrors.city).toBe("Choisis ta ville.")
    expect(result.fieldErrors.phone).toMatch(/10 chiffres/)
    expect(parseFormData(studentIdentitySchema, form({ ...valid, phone: "" })).fieldErrors.phone).toBe("Saisis ton numéro de téléphone.")
  })
})

describe("studentStudiesSchema", () => {
  const valid = { school: "IFRI", level: "Licence 2", skills: ["Babysitting"], availability: ["Soir", "Week-end"] }

  it("accepte des études complètes, une compétence arrivant en chaîne unique", () => {
    const result = parseFormData(studentStudiesSchema, form({ ...valid, skills: "Babysitting", availability: "Soir" }))
    expect(result.ok).toBe(true)
    expect(result.data.skills).toEqual(["Babysitting"])
    expect(result.data.availability).toEqual(["Soir"])
  })

  it("disponibilités facultatives", () => {
    const { availability, ...rest } = valid
    const result = parseFormData(studentStudiesSchema, form(rest))
    expect(result.ok).toBe(true)
    expect(result.data.availability).toEqual([])
  })

  it("refuse établissement, niveau et compétences manquants ou hors liste", () => {
    const result = parseFormData(studentStudiesSchema, form({ school: "", level: "CP", skills: [] }))
    expect(result.fieldErrors).toMatchObject({
      school: "Choisis ton établissement.",
      level: "Choisis ton niveau.",
      skills: "Choisis au moins une compétence.",
    })
    expect(parseFormData(studentStudiesSchema, form({ ...valid, skills: ["Piratage"] })).ok).toBe(false)
    expect(parseFormData(studentStudiesSchema, form({ ...valid, availability: ["Jamais"] })).ok).toBe(false)
  })

  it("exporte les listes utilisées par les écrans", () => {
    expect(STUDY_LEVELS).toContain("Licence 1")
    expect(AVAILABILITY_PRESETS).toEqual(["Matin", "Après-midi", "Soir", "Week-end"])
  })
})

describe("clientTypeSchema et clientIdentitySchema", () => {
  it("accepte les trois types et refuse le reste", () => {
    for (const clientType of ["particulier", "pme", "association"]) {
      expect(parseFormData(clientTypeSchema, form({ clientType })).ok).toBe(true)
    }
    expect(parseFormData(clientTypeSchema, form({ clientType: "admin" })).fieldErrors.clientType).toBe("Choisissez votre profil.")
    expect(parseFormData(clientTypeSchema, form({})).ok).toBe(false)
  })

  it("identité client vouvoyée avec téléphone E.164", () => {
    const ok = parseFormData(clientIdentitySchema, form({ name: "Atelier Dossou", city: "Cotonou", phone: "+229 0197452108" }))
    expect(ok.ok).toBe(true)
    expect(ok.data.phone).toBe("+2290197452108")
    const ko = parseFormData(clientIdentitySchema, form({ name: "", city: "Lyon", phone: "12" }))
    expect(ko.fieldErrors.name).toBe("Saisissez votre nom ou celui de votre structure.")
    expect(ko.fieldErrors.city).toBe("Choisissez votre ville.")
    expect(ko.fieldErrors.phone).toBeDefined()
  })
})

describe("parseFormData", () => {
  it("renvoie la première erreur de chaque champ", () => {
    const result = parseFormData(makeLoginSchema("student"), form({ email: "", password: "" }))
    expect(result.ok).toBe(false)
    expect(Object.keys(result.fieldErrors).sort()).toEqual(["email", "password"])
  })

  it("ignore les champs inconnus (role, is_verified)", () => {
    const result = parseFormData(forgotSchema, form({ email: "a@example.com", role: "admin", is_verified: "true" }))
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ email: "a@example.com" })
  })

  it("ignore les fichiers du FormData", () => {
    const fd = form({ email: "a@example.com" })
    fd.append("card", new Blob(["x"]), "x.png")
    expect(parseFormData(forgotSchema, fd).ok).toBe(true)
  })
})

describe("indépendance vis-à-vis du serveur", () => {
  it.each(["schemas.js", "destinations.js", "disposable-domains.js"])("%s n'importe aucun module serveur", (file) => {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8")
    expect(source).not.toMatch(/from\s+["'](dns|next\/headers|server-only)["']/)
    expect(source).not.toMatch(/utils\/email/)
  })
})
