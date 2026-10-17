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
    const result = parseFormData(makeRegisterSchema(), form({ ...validRegister, role }))
    expect(result.ok).toBe(true)
    expect(result.data.role).toBe(role)
    expect(result.data.cgu).toBe(true)
  })

  it.each([["admin"], ["superadmin"], [""], ["Student"]])("refuse le rôle %j avec un message lisible", (role) => {
    const result = parseFormData(makeRegisterSchema(), form({ ...validRegister, role }))
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.role).toBe("Choisissez si vous êtes étudiant ou client.")
  })

  it("refuse l'absence de rôle", () => {
    const { role, ...rest } = validRegister
    const result = parseFormData(makeRegisterSchema(), form(rest))
    expect(result.fieldErrors.role).toBe("Choisissez si vous êtes étudiant ou client.")
  })

  it("exige la case des conditions", () => {
    const { cgu, ...rest } = validRegister
    const result = parseFormData(makeRegisterSchema(), form(rest))
    expect(result.fieldErrors.cgu).toMatch(/Acceptez/)
    const off = parseFormData(makeRegisterSchema(), form({ ...validRegister, cgu: "off" }))
    expect(off.fieldErrors.cgu).toBeDefined()
  })

  it("exige une confirmation identique", () => {
    const result = parseFormData(makeRegisterSchema(), form({ ...validRegister, confirmPassword: "Autre1!aa" }))
    expect(result.fieldErrors).toEqual({ confirmPassword: "Les deux mots de passe ne sont pas identiques." })
  })

  it("exige une confirmation renseignée", () => {
    const result = parseFormData(makeRegisterSchema(), form({ ...validRegister, confirmPassword: "" }))
    expect(result.fieldErrors.confirmPassword).toBe("Confirmez votre mot de passe.")
  })

  it.each(["abc", "abcdefgh", "ABCDEFG1!", "Abcdefgh1", "Ab1!"])("refuse le mot de passe faible %j", (password) => {
    const result = parseFormData(
      makeRegisterSchema(),
      form({ ...validRegister, password, confirmPassword: password })
    )
    expect(result.fieldErrors.password).toMatch(/règles/)
  })

  it("refuse un email jetable et un email invalide", () => {
    const disposable = parseFormData(makeRegisterSchema(), form({ ...validRegister, email: "x@Mailinator.com" }))
    expect(disposable.fieldErrors.email).toMatch(/jetables/)
    const invalid = parseFormData(makeRegisterSchema(), form({ ...validRegister, email: "pas-un-email" }))
    expect(invalid.fieldErrors.email).toBe("Cette adresse email n'est pas valide.")
  })

  it("refuse un email de plus de 254 caractères", () => {
    const long = `${"a".repeat(250)}@example.com`
    const result = parseFormData(makeRegisterSchema(), form({ ...validRegister, email: long }))
    expect(result.fieldErrors.email).toMatch(/254/)
  })

  it("coupe les espaces autour de l'email", () => {
    const result = parseFormData(makeRegisterSchema(), form({ ...validRegister, email: "  sena@example.com " }))
    expect(result.data.email).toBe("sena@example.com")
  })
})

describe("messages : vouvoiement pour tous", () => {
  const empty = form({})
  const TU_FORMS = /(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu

  it("vouvoie, quel que soit l'argument d'audience hérité des anciens appels", () => {
    const expected = { email: "Saisissez votre adresse email.", password: "Saisissez votre mot de passe." }
    expect(parseFormData(makeLoginSchema(), empty).fieldErrors).toEqual(expected)
    expect(parseFormData(makeLoginSchema("student"), empty).fieldErrors).toEqual(expected)
    expect(parseFormData(makeLoginSchema("client"), empty).fieldErrors).toEqual(expected)
    expect(parseFormData(loginSchema, empty).fieldErrors).toEqual(expected)
  })

  it("n'emploie aucune forme du tutoiement, inscription et onboardings compris", () => {
    const messages = [
      parseFormData(makeRegisterSchema(), empty).fieldErrors,
      parseFormData(studentIdentitySchema, empty).fieldErrors,
      parseFormData(studentStudiesSchema, empty).fieldErrors,
      parseFormData(clientTypeSchema, empty).fieldErrors,
      parseFormData(clientIdentitySchema, empty).fieldErrors,
      parseFormData(makeRegisterSchema(), form({ ...validRegister, role: "x", email: "a@mailinator.com", password: "abc", confirmPassword: "zz" })).fieldErrors,
      parseFormData(studentIdentitySchema, form({ fullName: "1234", city: "Paris", phone: "1", bio: "x".repeat(201) })).fieldErrors,
    ].flatMap((errors) => Object.values(errors))
    expect(messages.length).toBeGreaterThan(10)
    expect(messages.join(" ")).not.toMatch(TU_FORMS)
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
    expect(parseFormData(makeForgotSchema(), form({ email: "nope" })).fieldErrors.email).toBeDefined()
    expect(parseFormData(resendSchema, form({ email: "a@example.com" })).ok).toBe(true)
    expect(parseFormData(makeResendSchema(), form({ email: "" })).fieldErrors.email).toMatch(/Saisissez/)
  })

  it("reset : règles et confirmation", () => {
    expect(parseFormData(resetSchema, form({ password: STRONG, confirmPassword: STRONG })).ok).toBe(true)
    expect(parseFormData(resetSchema, form({ password: "abc", confirmPassword: "abc" })).fieldErrors.password).toBeDefined()
    expect(
      parseFormData(makeResetSchema(), form({ password: STRONG, confirmPassword: "Zzzzzz1!" })).fieldErrors.confirmPassword
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
    expect(parseFormData(studentIdentitySchema, form({ ...valid, fullName: "" })).fieldErrors.fullName).toBe("Saisissez votre nom et votre prénom.")
  })

  it("refuse une ville hors CITIES et un téléphone invalide, avec messages vouvoyés", () => {
    const result = parseFormData(studentIdentitySchema, form({ ...valid, city: "Paris", phone: "97 45 21" }))
    expect(result.fieldErrors.city).toBe("Choisissez votre ville.")
    expect(result.fieldErrors.phone).toMatch(/10 chiffres/)
    expect(parseFormData(studentIdentitySchema, form({ ...valid, phone: "" })).fieldErrors.phone).toBe("Saisissez votre numéro de téléphone.")
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
      school: "Choisissez votre établissement.",
      level: "Choisissez votre niveau.",
      skills: "Choisissez au moins une compétence.",
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
    const result = parseFormData(makeLoginSchema(), form({ email: "", password: "" }))
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

describe("confirmation et listes (corrections d'intégration)", () => {
  it("signale la confirmation différente même si d'autres champs sont invalides", () => {
    const fd = new FormData()
    fd.set("role", "student")
    fd.set("email", "pas-un-email")
    fd.set("password", "Abcdef1!x")
    fd.set("confirmPassword", "Autre1!xyz")
    const result = parseFormData(makeRegisterSchema(), fd)
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.email).toBeDefined()
    expect(result.fieldErrors.confirmPassword).toMatch(/pas identiques/)
  })

  it("dédoublonne les listes et refuse une valeur hors liste (l'enum rejette)", () => {
    const base = { school: "UAC", level: STUDY_LEVELS[0], availability: ["Matin", "Matin"] }
    const ok = studentStudiesSchema.parse({ ...base, skills: ["Livraison", "Livraison"] })
    expect(ok.skills).toEqual(["Livraison"])
    expect(ok.availability).toEqual(["Matin"])
    expect(studentStudiesSchema.safeParse({ ...base, skills: Array(30).fill("Livraison").map((v, i) => `${v}${i}`) }).success).toBe(false)
  })
})

describe("libellé réservé aux comptes clôturés", () => {
  const phone = "01 97 45 21 08"
  it.each(["Compte clôturé", "compte cloture", "  COMPTE   CLÔTURÉ ", "Compte\u00a0clôturé", "Compte clo\u200Bturé"])(
    "refuse %j comme nom (étudiant et client)",
    (name) => {
      const student = parseFormData(studentIdentitySchema, form({ fullName: name, city: "Abomey-Calavi", phone, bio: "" }))
      expect(student.ok).toBe(false)
      expect(student.fieldErrors.fullName).toBe("Ce nom n'est pas disponible.")
      const client = parseFormData(clientIdentitySchema, form({ name, city: "Abomey-Calavi", phone }))
      expect(client.ok).toBe(false)
      expect(client.fieldErrors.name).toBe("Ce nom n'est pas disponible.")
    },
  )

  it("accepte des noms ordinaires proches", () => {
    for (const name of ["Compte Clôturé Agossou", "Sèna Agossou", "Clôture Dossou"]) {
      const result = parseFormData(studentIdentitySchema, form({ fullName: name, city: "Abomey-Calavi", phone, bio: "" }))
      expect(result.ok).toBe(true)
    }
  })
})
