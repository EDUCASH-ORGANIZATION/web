// Schémas de validation du parcours d'authentification et de l'onboarding.
// JS pur, partagé par les formulaires (navigateur) et les actions (serveur) :
// aucun import de `dns`, `next/headers` ni `server-only`.
import { z } from "zod"
import { CITIES, MISSION_TYPES } from "@/lib/supabase/database.constants"
import { isDisposableDomain } from "@/lib/auth/disposable-domains"
import { makeBeninPhoneSchema } from "@/lib/utils/phone"

export const AUDIENCES = ["student", "client"]
export const SIGNUP_ROLES = ["student", "client"]
export const CLIENT_TYPES = ["particulier", "pme", "association"]

export const EMAIL_MAX = 254
export const NAME_MIN = 2
export const NAME_MAX = 80
export const BIO_MAX = 200

export const PASSWORD_RULES = [
  { key: "length", label: "Au moins 8 caractères", test: (v) => v.length >= 8 },
  { key: "uppercase", label: "Une majuscule (A-Z)", test: (v) => /[A-Z]/.test(v) },
  { key: "lowercase", label: "Une minuscule (a-z)", test: (v) => /[a-z]/.test(v) },
  { key: "number", label: "Un chiffre (0-9)", test: (v) => /[0-9]/.test(v) },
  { key: "special", label: "Un caractère spécial (!@#$...)", test: (v) => /[^A-Za-z0-9]/.test(v) },
]

export const STUDY_LEVELS = [
  "Licence 1",
  "Licence 2",
  "Licence 3",
  "Master 1",
  "Master 2",
  "BTS",
  "Doctorat",
  "Autre",
]

export const AVAILABILITY_PRESETS = ["Matin", "Après-midi", "Soir", "Week-end"]

// Messages : vouvoiement pour tous les publics. Les libellés communs sont partagés,
// l'identité étudiant et l'identité client gardent leurs propres formulations.
const COMMON = {
  emailRequired: "Saisissez votre adresse email.",
  emailInvalid: "Cette adresse email n'est pas valide.",
  emailTooLong: `Votre adresse email ne doit pas dépasser ${EMAIL_MAX} caractères.`,
  emailDisposable: "Les adresses email jetables ne sont pas acceptées. Utilisez une adresse personnelle.",
  passwordRequired: "Saisissez votre mot de passe.",
  passwordWeak: "Votre mot de passe doit respecter toutes les règles ci-dessous.",
  confirmRequired: "Confirmez votre mot de passe.",
  confirmMismatch: "Les deux mots de passe ne sont pas identiques.",
  role: "Choisissez si vous êtes étudiant ou client.",
  cgu: "Acceptez les conditions d'utilisation et la politique de confidentialité pour continuer.",
  city: "Choisissez votre ville.",
  phoneEmpty: "Saisissez votre numéro de téléphone.",
}

const STUDENT = {
  ...COMMON,
  nameRequired: "Saisissez votre nom et votre prénom.",
  nameLength: `Votre nom doit faire entre ${NAME_MIN} et ${NAME_MAX} caractères.`,
  nameLetter: "Votre nom doit contenir au moins une lettre.",
  bio: `Votre bio ne doit pas dépasser ${BIO_MAX} caractères.`,
  school: "Choisissez votre établissement.",
  level: "Choisissez votre niveau.",
  skills: "Choisissez au moins une compétence.",
  availability: "Une disponibilité n'est pas valide.",
}

const CLIENT = {
  ...COMMON,
  nameRequired: "Saisissez votre nom ou celui de votre structure.",
  nameLength: `Le nom doit faire entre ${NAME_MIN} et ${NAME_MAX} caractères.`,
  nameLetter: "Le nom doit contenir au moins une lettre.",
  clientType: "Choisissez votre profil.",
}

function phoneSchema(m) {
  return makeBeninPhoneSchema({ empty: m.phoneEmpty })
}

export function makeEmailSchema() {
  const m = COMMON
  return z
    .string({ error: m.emailRequired })
    .trim()
    .min(1, m.emailRequired)
    .max(EMAIL_MAX, m.emailTooLong)
    .pipe(z.email(m.emailInvalid))
    .refine((email) => !isDisposableDomain(email.split("@")[1]), m.emailDisposable)
}

function makePasswordSchema() {
  const m = COMMON
  return z
    .string({ error: m.passwordRequired })
    .min(1, m.passwordRequired)
    .refine((value) => PASSWORD_RULES.every((rule) => rule.test(value)), m.passwordWeak)
}

// Connexion : pas de règle de complexité (les anciens comptes restent utilisables).
export function makeLoginSchema() {
  const m = COMMON
  return z.object({
    email: z.string({ error: m.emailRequired }).trim().min(1, m.emailRequired).max(EMAIL_MAX, m.emailTooLong),
    password: z.string({ error: m.passwordRequired }).min(1, m.passwordRequired),
  })
}

function withConfirmation(shape, m) {
  // `when` : le contrôle s'exécute même si d'autres champs sont invalides.
  return z.object(shape).refine(
    (value) => !(typeof value.confirmPassword === "string" && value.confirmPassword !== "" && value.password !== value.confirmPassword),
    { path: ["confirmPassword"], message: m.confirmMismatch, when: () => true }
  )
}

function confirmField(m) {
  return z.string({ error: m.confirmRequired }).min(1, m.confirmRequired)
}

// Inscription : seuls student et client sont acceptés, jamais admin.
export function makeRegisterSchema() {
  const m = COMMON
  return withConfirmation(
    {
      role: z.enum(SIGNUP_ROLES, { error: m.role }),
      email: makeEmailSchema(),
      password: makePasswordSchema(),
      confirmPassword: confirmField(m),
      cgu: z.preprocess(
        (value) => value === true || value === "on" || value === "true" || value === "1",
        z.literal(true, { error: m.cgu })
      ),
    },
    m
  )
}

export function makeForgotSchema() {
  return z.object({ email: makeEmailSchema() })
}

export function makeResendSchema() {
  return z.object({ email: makeEmailSchema() })
}

export function makeResetSchema() {
  const m = COMMON
  return withConfirmation(
    { password: makePasswordSchema(), confirmPassword: confirmField(m) },
    m
  )
}

function nameSchema(m) {
  return z
    .string({ error: m.nameRequired })
    .trim()
    .min(1, m.nameRequired)
    .pipe(
      z
        .string()
        .min(NAME_MIN, m.nameLength)
        .max(NAME_MAX, m.nameLength)
        .refine((value) => /\p{L}/u.test(value), m.nameLetter)
    )
}

function citySchema(m) {
  return z.enum(CITIES, { error: m.city })
}

// Valeur multiple : un champ de formulaire à une seule valeur arrive en chaîne.
function listOf(item, min, minMessage, max = 20) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return []
      return Array.isArray(value) ? value : [value]
    },
    // Valeurs dédoublonnées avant contrôle de la taille.
    z.array(item).transform((list) => [...new Set(list)]).pipe(z.array(item).min(min, minMessage).max(max, minMessage))
  )
}

export function makeStudentIdentitySchema() {
  const m = STUDENT
  return z.object({
    fullName: nameSchema(m),
    city: citySchema(m),
    phone: phoneSchema(m),
    bio: z
      .string()
      .trim()
      .max(BIO_MAX, m.bio)
      .optional()
      .transform((value) => value ?? ""),
  })
}

export function makeStudentStudiesSchema() {
  const m = STUDENT
  return z.object({
    school: z.string({ error: m.school }).trim().min(1, m.school).max(120, m.school),
    level: z.enum(STUDY_LEVELS, { error: m.level }),
    skills: listOf(z.enum(MISSION_TYPES, { error: m.skills }), 1, m.skills),
    availability: listOf(z.enum(AVAILABILITY_PRESETS, { error: m.availability }), 0, m.availability),
  })
}

export function makeClientTypeSchema() {
  const m = CLIENT
  return z.object({ clientType: z.enum(CLIENT_TYPES, { error: m.clientType }) })
}

export function makeClientIdentitySchema() {
  const m = CLIENT
  return z.object({
    name: nameSchema(m),
    city: citySchema(m),
    phone: phoneSchema(m),
  })
}

// Schémas prêts à l'emploi (vouvoiement partout).
export const loginSchema = makeLoginSchema()
export const forgotSchema = makeForgotSchema()
export const resendSchema = makeResendSchema()
export const resetSchema = makeResetSchema()
export const studentIdentitySchema = makeStudentIdentitySchema()
export const studentStudiesSchema = makeStudentStudiesSchema()
export const clientTypeSchema = makeClientTypeSchema()
export const clientIdentitySchema = makeClientIdentitySchema()

function formDataToObject(formData) {
  const values = {}
  for (const key of new Set(formData.keys())) {
    const all = formData.getAll(key).filter((value) => typeof value === "string")
    values[key] = all.length > 1 ? all : (all[0] ?? "")
  }
  return values
}

/**
 * Valide un FormData. Une seule erreur par champ (la première).
 * @param {z.ZodType} schema
 * @param {FormData} formData
 * @returns {{ ok: true, data: any } | { ok: false, fieldErrors: Record<string, string> }}
 */
export function parseFormData(schema, formData) {
  const result = schema.safeParse(formDataToObject(formData))
  if (result.success) return { ok: true, data: result.data }

  const fieldErrors = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form")
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message
  }
  return { ok: false, fieldErrors }
}
