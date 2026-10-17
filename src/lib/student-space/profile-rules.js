// @ds-screen RD-STUDENT-01
// Règles du profil étudiant (E10 et E11), partagées par le formulaire (contrôle local) et par l'action serveur
// (autorité). Pur : aucun accès aux données. Les messages s'adressent à l'étudiant au vouvoiement.
import { CITIES, MISSION_TYPES } from "../supabase/database.constants.js"
import { isReservedDisplayName } from "../account-closure/closure-rules.js"
import { BENIN_PHONE_MESSAGES, parseBeninPhone } from "../utils/phone.js"

export const NAME_MAX = 100
export const BIO_MAX = 400
export const SCHOOL_MAX = 120
export const AVAILABILITY_MAX = 200
export const SKILLS_MAX = 8
export const SKILL_MAX_LENGTH = 50

export const AVATAR_MAX_BYTES = 3 * 1024 * 1024
export const AVATAR_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

export const STUDY_LEVELS = ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2", "BTS", "Doctorat", "Autre"]
export const AVAILABILITY_PRESETS = ["Jours de semaine", "Week-end", "Matin", "Après-midi", "Soirée"]
export const OTHER_SCHOOL = "__other__"

// Compétences proposées : les types de mission (valeurs de la base, affichées par `missionTypeLabel`) puis
// quelques compétences libres déjà utilisées par les étudiants.
const EXTRA_SKILLS = ["Mathématiques", "Physique-Chimie", "Informatique", "Rédaction Web", "Microsoft Excel", "AutoCAD", "Comptabilité", "Marketing"]
export const SKILL_OPTIONS = [...MISSION_TYPES.filter((type) => type !== "Autre"), ...EXTRA_SKILLS]

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/
// Hors retours à la ligne et tabulations, permis dans une présentation.
const TEXT_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/

const ERR_AVATAR_TYPE = "Choisissez une image PNG, JPG ou WebP."
const ERR_AVATAR_SIZE = "Cette image dépasse 3 Mo. Choisissez-en une plus légère."

/**
 * Contrôle d'un fichier de photo choisi.
 * @param {{ type?: string, size?: number } | null | undefined} file
 * @returns {string | null} message d'erreur, ou null si le fichier convient
 */
export function checkAvatarFile(file) {
  if (!file) return null
  if (!Object.hasOwn(AVATAR_EXTENSIONS, file.type)) return ERR_AVATAR_TYPE
  if (!(file.size <= AVATAR_MAX_BYTES)) return ERR_AVATAR_SIZE
  return null
}

/** Chemin d'une nouvelle photo : nom unique (horodatage) dans le dossier de l'utilisateur, jamais d'écrasement. */
export function avatarPath(userId, mimeType, stamp = Date.now()) {
  return `${userId}/avatar-${stamp}.${AVATAR_EXTENSIONS[mimeType]}`
}

/**
 * Sépare le texte « Disponibilités » stocké en choix prédéfinis et texte libre.
 * @param {string | null | undefined} value
 * @returns {{ presets: string[], other: string }}
 */
export function parseAvailability(value) {
  const parts = String(value ?? "")
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
  return {
    presets: parts.filter((part) => AVAILABILITY_PRESETS.includes(part)),
    other: parts.filter((part) => !AVAILABILITY_PRESETS.includes(part) && part !== "Autre").join(", "),
  }
}

/** Texte « Disponibilités » à enregistrer : choix prédéfinis, puis texte libre. */
export function formatAvailability(presets, other) {
  const kept = AVAILABILITY_PRESETS.filter((preset) => presets.includes(preset))
  const extra = String(other ?? "").trim()
  return (extra ? [...kept, extra] : kept).join(", ")
}

/**
 * Éléments du profil encore à renseigner. Liste vide : profil complet.
 * @param {{ bio?: string|null, school?: string|null, level?: string|null, skills?: string[], avatarUrl?: string|null }} identity
 * @returns {string[]}
 */
export function missingProfileItems(identity) {
  const missing = []
  if (!identity?.avatarUrl) missing.push("une photo")
  if (!identity?.bio) missing.push("une présentation")
  if (!identity?.school) missing.push("votre établissement")
  if (!identity?.level) missing.push("votre niveau d'études")
  if (!identity?.skills?.length) missing.push("vos compétences")
  return missing
}

/**
 * Contrôle des champs (le serveur reste l'autorité : il rejoue ce contrôle). Le téléphone est obligatoire et
 * béninois (10 chiffres, commence par 01) : il sert aux retraits. La liste de niveaux et de villes est fermée.
 * @param {{ fullName?: string, city?: string, phone?: string, bio?: string, school?: string, level?: string,
 *   availability?: string, skills?: string[] }} values
 * @returns {Partial<Record<"fullName" | "city" | "phone" | "bio" | "school" | "level" | "availability" | "skills", string>>}
 */
export function validateStudentProfile(values) {
  const errors = {}
  const name = typeof values.fullName === "string" ? values.fullName.trim() : ""
  if (!name) errors.fullName = "Indiquez votre nom."
  else if (name.length > NAME_MAX) errors.fullName = `Votre nom ne doit pas dépasser ${NAME_MAX} caractères.`
  else if (CONTROL_CHARS.test(name)) errors.fullName = "Votre nom contient un caractère non autorisé."
  else if (isReservedDisplayName(name)) errors.fullName = "Ce nom n'est pas disponible."

  if (!CITIES.includes(values.city)) errors.city = "Choisissez votre ville."

  const parsed = parseBeninPhone(values.phone)
  if (!parsed.ok) errors.phone = BENIN_PHONE_MESSAGES[parsed.reason]

  const bio = typeof values.bio === "string" ? values.bio.trim() : ""
  if (bio.length > BIO_MAX) errors.bio = `Votre présentation ne doit pas dépasser ${BIO_MAX} caractères.`
  else if (TEXT_CONTROL_CHARS.test(bio)) errors.bio = "Votre présentation contient un caractère non autorisé."

  const school = typeof values.school === "string" ? values.school.trim() : ""
  if (school.length > SCHOOL_MAX) errors.school = `Le nom de l'établissement ne doit pas dépasser ${SCHOOL_MAX} caractères.`
  else if (CONTROL_CHARS.test(school)) errors.school = "Ce nom contient un caractère non autorisé."

  const level = typeof values.level === "string" ? values.level.trim() : ""
  if (level && !STUDY_LEVELS.includes(level)) errors.level = "Choisissez un niveau de la liste."

  const availability = typeof values.availability === "string" ? values.availability.trim() : ""
  if (availability.length > AVAILABILITY_MAX) {
    errors.availability = `Vos disponibilités ne doivent pas dépasser ${AVAILABILITY_MAX} caractères.`
  } else if (CONTROL_CHARS.test(availability)) {
    errors.availability = "Vos disponibilités contiennent un caractère non autorisé."
  }

  const skills = values.skills
  if (skills !== undefined) {
    if (!Array.isArray(skills) || skills.some((skill) => typeof skill !== "string")) {
      errors.skills = "Vos compétences ne sont pas valides."
    } else if (skills.length > SKILLS_MAX) {
      errors.skills = `Choisissez ${SKILLS_MAX} compétences au plus.`
    } else if (skills.some((skill) => !skill.trim() || skill.length > SKILL_MAX_LENGTH || CONTROL_CHARS.test(skill))) {
      errors.skills = "Vos compétences ne sont pas valides."
    }
  }
  return errors
}
