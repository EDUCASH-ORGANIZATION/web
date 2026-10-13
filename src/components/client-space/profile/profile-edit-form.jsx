"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { TextField, SelectField } from "@/components/app-ui/fields"
import { ErrorState } from "@/components/app-ui/state-block"
import { useAppToast } from "@/components/app-ui/toast"
import { PhoneInput } from "@/components/auth/ui/phone-input"
import { useSupabase } from "@/components/shared/supabase-provider"
import { updateClientProfile } from "@/lib/actions/profile.actions"
import { initialsOf } from "@/lib/app/format"
import { CITIES } from "@/lib/supabase/database.constants"
import { BENIN_PHONE_MESSAGES, formatBeninPhone, parseBeninPhone } from "@/lib/utils/phone"

const PROFILE_HREF = "/client/profile"
const NAME_MAX = 100
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/

export const LOGO_MAX_BYTES = 3 * 1024 * 1024
export const LOGO_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

/** Chemin d'un nouveau logo : nom unique (horodatage) dans le dossier de l'utilisateur, jamais d'écrasement. */
export function logoPath(userId, mimeType, stamp = Date.now()) {
  return `${userId}/avatar-${stamp}.${LOGO_EXTENSIONS[mimeType]}`
}

const ERR_LOGO_TYPE = "Choisissez une image PNG, JPG ou WebP."
const ERR_LOGO_SIZE = "Cette image dépasse 3 Mo. Choisissez-en une plus légère."
const ERR_LOGO_UPLOAD = "Le logo n'a pas pu être envoyé. Réessayez ou retirez-le."
const ERR_UNEXPECTED = "Une erreur inattendue est survenue. Réessayez."

const CITY_OPTIONS = CITIES.map((city) => ({ value: city, label: city }))

/**
 * Contrôle d'un fichier de logo choisi.
 * @param {{ type?: string, size?: number } | null | undefined} file
 * @returns {string | null} message d'erreur, ou null si le fichier convient
 */
export function checkLogoFile(file) {
  if (!file) return null
  if (!LOGO_EXTENSIONS[file.type]) return ERR_LOGO_TYPE
  if (!(file.size <= LOGO_MAX_BYTES)) return ERR_LOGO_SIZE
  return null
}

/**
 * Contrôle local des champs (le serveur reste l'autorité). Le téléphone est facultatif ; renseigné, il doit être
 * béninois (10 chiffres, commence par 01).
 * @param {{ fullName: string, companyName: string, city: string, phone: string }} values
 * @returns {Partial<Record<"fullName" | "companyName" | "city" | "phone", string>>}
 */
export function validateProfileForm(values) {
  const errors = {}
  const name = values.fullName.trim()
  if (!name) errors.fullName = "Indiquez votre nom."
  else if (name.length > NAME_MAX) errors.fullName = `Votre nom ne doit pas dépasser ${NAME_MAX} caractères.`
  else if (CONTROL_CHARS.test(values.fullName)) errors.fullName = "Votre nom contient un caractère non autorisé."

  const company = values.companyName.trim()
  if (company.length > NAME_MAX) errors.companyName = `Ce nom ne doit pas dépasser ${NAME_MAX} caractères.`
  else if (CONTROL_CHARS.test(values.companyName)) errors.companyName = "Ce nom contient un caractère non autorisé."

  if (!CITIES.includes(values.city)) errors.city = "Choisissez votre ville."

  if (values.phone.trim()) {
    const parsed = parseBeninPhone(values.phone)
    if (!parsed.ok) errors.phone = BENIN_PHONE_MESSAGES[parsed.reason]
  }
  return errors
}

/**
 * Valide, envoie le logo si besoin, puis enregistre. Fonction à dépendances injectées (`upload`, `update`) :
 * testable sans réseau. Les champs sont conservés par l'appelant quelle que soit l'issue.
 * @param {{ values: object, logoFile: File | null }} input
 * @param {{ upload: (file: File) => Promise<string>, update: (data: object) => Promise<{ error?: string }> }} deps
 * @returns {Promise<{ kind: "invalid", errors: object } | { kind: "error", error: string, logo?: boolean } | { kind: "done" }>}
 */
export async function submitProfile({ values, logoFile }, { upload, update }) {
  const errors = validateProfileForm(values)
  if (Object.keys(errors).length > 0) return { kind: "invalid", errors }

  let avatarUrl
  if (logoFile) {
    try {
      avatarUrl = await upload(logoFile)
    } catch {
      return { kind: "error", error: ERR_LOGO_UPLOAD, logo: true }
    }
  }
  try {
    const result = await update({
      fullName: values.fullName.trim(),
      city: values.city,
      phone: values.phone.trim(),
      companyName: values.companyName.trim(),
      avatarUrl,
    })
    return result?.error ? { kind: "error", error: result.error } : { kind: "done" }
  } catch {
    return { kind: "error", error: ERR_UNEXPECTED }
  }
}

function LogoPicker({ name, currentUrl, previewUrl, error, hasNewFile, onPick, onClear }) {
  const uid = useId()
  const inputRef = useRef(null)
  const shown = previewUrl || currentUrl
  const helpId = `${uid}-help`
  const errorId = `${uid}-error`
  return (
    <div className="field">
      <span className="field__label" id={`${uid}-label`}>
        Logo ou photo
        <span className="opt">(facultatif)</span>
      </span>
      <div className="logo2" role="group" aria-labelledby={`${uid}-label`}>
        <span className="av2 logo2__img">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Aperçu du logo" />
          ) : (
            initialsOf(name)
          )}
        </span>
        <div className="actions2">
          <button
            type="button"
            className="btn btn--soft btn--sm"
            onClick={() => inputRef.current?.click()}
            aria-describedby={[helpId, error ? errorId : null].filter(Boolean).join(" ")}
          >
            <Icon name="i-upload" />
            {shown ? "Changer" : "Choisir un fichier"}
          </button>
          {hasNewFile ? (
            <button type="button" className="link2 logo2__clear" onClick={onClear}>
              Retirer ce fichier
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) onPick(file)
          }}
        />
      </div>
      <div id={helpId} className="field__help">
        <span>JPG, PNG ou WebP · 3 Mo maximum. Un logo rassure les étudiants.</span>
      </div>
      {error ? (
        <div id={errorId} className="field__error" role="alert">
          <Icon name="i-alert-circle" />
          {error}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Formulaire de modification du profil client. Le logo part du navigateur vers `avatars/<userId>/...`, puis seule
 * son URL publique est transmise à `updateClientProfile`, qui la valide (dossier de l'utilisateur, bucket avatars).
 * @param {{ identity: import("@/lib/actions/profile.actions").ClientProfileSummary["identity"] }} props
 */
export function ProfileEditForm({ identity }) {
  const router = useRouter()
  const toast = useAppToast()
  const { supabase } = useSupabase()
  const [values, setValues] = useState({
    fullName: identity.fullName ?? "",
    companyName: identity.companyName ?? "",
    city: CITIES.includes(identity.city) ? identity.city : "",
    phone: identity.phone ? formatBeninPhone(identity.phone) : "",
  })
  const [logoFile, setLogoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [errors, setErrors] = useState({})
  const [logoError, setLogoError] = useState("")
  const [formError, setFormError] = useState("")
  const [sending, setSending] = useState(false)
  // Un second clic avant le retour du serveur ne relance jamais l'enregistrement.
  const busy = useRef(false)
  const uid = useId()

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function change(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function pickLogo(file) {
    const problem = checkLogoFile(file)
    setLogoError(problem ?? "")
    if (problem) return
    setLogoFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function clearLogo() {
    setLogoFile(null)
    setPreviewUrl("")
    setLogoError("")
  }

  async function uploadLogo(file) {
    const path = logoPath(identity.userId, file.type)
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: false })
    if (error) throw error
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setSending(true)
    setFormError("")
    const result = await submitProfile({ values, logoFile }, { upload: uploadLogo, update: updateClientProfile })
    busy.current = false
    setSending(false)

    if (result.kind === "invalid") {
      setErrors(result.errors)
      setFormError("Certains champs sont à corriger avant d'enregistrer.")
      return
    }
    if (result.kind === "error") {
      if (result.logo) setLogoError(result.error)
      else setFormError(result.error)
      return
    }
    toast.success("Profil enregistré", "Vos modifications sont à jour.")
    router.push(PROFILE_HREF)
    router.refresh()
  }

  return (
    <div className="profile2">
      <PageHead date="Mettez à jour les informations affichées sur vos missions" title="Modifier mon profil" />
      <section className="card2 form2 profile2__form" aria-label="Informations du profil">
        {formError ? (
          <div className="banner banner--erreur" role="alert">
            <Icon name="i-alert-circle" />
            <div className="banner__body">
              <div className="banner__title">Enregistrement impossible</div>
              {formError}
            </div>
          </div>
        ) : null}
        <form className="form2" onSubmit={onSubmit} noValidate>
          <LogoPicker
            name={values.fullName}
            currentUrl={identity.avatarUrl}
            previewUrl={previewUrl}
            error={logoError}
            hasNewFile={Boolean(logoFile)}
            onPick={pickLogo}
            onClear={clearLogo}
          />
          <div className="field-grid2">
            <TextField
              label="Nom du contact"
              required
              name="fullName"
              autoComplete="name"
              maxLength={NAME_MAX}
              value={values.fullName}
              onChange={(e) => change("fullName", e.target.value)}
              help="Votre prénom et nom."
              error={errors.fullName}
              disabled={sending}
            />
            <TextField
              label="Nom de la structure"
              optional
              name="companyName"
              autoComplete="organization"
              maxLength={NAME_MAX}
              value={values.companyName}
              onChange={(e) => change("companyName", e.target.value)}
              help="Votre entreprise ou votre association, si vous en avez une."
              error={errors.companyName}
              disabled={sending}
            />
            <SelectField
              label="Ville"
              required
              name="city"
              options={CITY_OPTIONS}
              value={values.city}
              onChange={(value) => change("city", value)}
              placeholder="Choisir une ville"
              error={errors.city}
              disabled={sending}
            />
            <div className="field">
              <label className="field__label" htmlFor={`${uid}-phone`}>
                Téléphone
                <span className="opt">(facultatif)</span>
              </label>
              <PhoneInput
                id={`${uid}-phone`}
                value={values.phone}
                onChange={(e) => change("phone", e.target.value)}
                invalid={Boolean(errors.phone)}
                disabled={sending}
                aria-describedby={`${uid}-phone-help${errors.phone ? ` ${uid}-phone-error` : ""}`}
              />
              <div id={`${uid}-phone-help`} className="field__help">
                <span>Jamais affiché publiquement. Sert aux retraits et aux urgences de mission.</span>
              </div>
              {errors.phone ? (
                <div id={`${uid}-phone-error`} className="field__error" role="alert">
                  <Icon name="i-alert-circle" />
                  {errors.phone}
                </div>
              ) : null}
            </div>
          </div>
          <div className="form2__foot">
            <Link className="link2 link2--muted" href={PROFILE_HREF}>
              Annuler
            </Link>
            <button type="submit" className="btn btn--dark" disabled={sending}>
              {sending ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

/**
 * Édition du profil client (C17). `summary` vient de `getClientProfileSummary` ; sans lecture fiable du profil,
 * le formulaire n'est pas rendu (il enverrait un téléphone vide et l'effacerait).
 * @param {{ summary?: import("@/lib/actions/profile.actions").ClientProfileSummary, error?: string }} props
 */
export function ProfileEditView({ summary, error }) {
  if (error || !summary) {
    return (
      <div className="page2">
        <ErrorState titleAs="h1" title="Impossible de charger votre profil" />
      </div>
    )
  }
  return <ProfileEditForm identity={summary.identity} />
}

export default ProfileEditView
