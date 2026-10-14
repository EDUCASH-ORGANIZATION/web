"use client"

// @ds-screen RD-STUDENT-01
import { useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { TextField, TextareaField, SelectField } from "@/components/app-ui/fields"
import { Avatar } from "@/components/app-ui/avatar"
import { ErrorState } from "@/components/app-ui/state-block"
import { useAppToast } from "@/components/app-ui/toast"
import { PhoneInput } from "@/components/auth/ui/phone-input"
import { useSupabase } from "@/components/shared/supabase-provider"
import { saveStudentProfile } from "@/lib/actions/student-profile.actions"
import { initialsOf } from "@/lib/app/format"
import { publicTalentHref, studentProfileHref } from "@/lib/app/student-routes"
import { CITIES, missionTypeLabel } from "@/lib/constants/missions"
import {
  AVAILABILITY_PRESETS,
  BIO_MAX,
  NAME_MAX,
  OTHER_SCHOOL,
  SCHOOL_MAX,
  SKILLS_MAX,
  SKILL_OPTIONS,
  STUDY_LEVELS,
  avatarPath,
  checkAvatarFile,
  formatAvailability,
  parseAvailability,
  validateStudentProfile,
} from "@/lib/student-space/profile-rules"
import { formatBeninPhone } from "@/lib/utils/phone"
import { publicDisplayName } from "@/lib/vitrine/public-name"

const AVAILABILITY_OTHER_MAX = 100
const LEAVE_MESSAGE = "Vous avez des modifications non enregistrées. Quitter cette page sans les enregistrer ?"
const ERR_AVATAR_UPLOAD = "La photo n'a pas pu être envoyée. Réessayez ou retirez-la."
const ERR_UNEXPECTED = "Une erreur inattendue est survenue. Réessayez."

const CITY_OPTIONS = CITIES.map((city) => ({ value: city, label: city }))
const LEVEL_OPTIONS = STUDY_LEVELS.map((level) => ({ value: level, label: level }))

/**
 * Valeurs de départ du formulaire à partir de celles lues par `getStudentProfileForm`.
 * L'établissement actuel est reconnu dans la liste des universités ; sinon il passe en « Autre établissement ».
 */
export function initialValues(form) {
  const v = form.values
  const known = form.universities.find((u) => u.name === v.school || (u.shortName && u.shortName === v.school))
  const availability = parseAvailability(v.availability)
  return {
    fullName: v.fullName ?? "",
    city: CITIES.includes(v.city) ? v.city : "",
    phone: v.phone ? formatBeninPhone(v.phone) : "",
    bio: v.bio ?? "",
    school: known ? known.name : v.school ? OTHER_SCHOOL : "",
    schoolOther: known || !v.school ? "" : v.school,
    level: STUDY_LEVELS.includes(v.level) ? v.level : "",
    presets: availability.presets,
    availabilityOther: availability.other,
    skills: [...v.skills],
  }
}

/** Valeurs à envoyer au serveur (établissement et disponibilités reconstitués). */
export function toPayload(values) {
  return {
    fullName: values.fullName.trim(),
    city: values.city,
    phone: values.phone.trim(),
    bio: values.bio.trim(),
    school: (values.school === OTHER_SCHOOL ? values.schoolOther : values.school).trim(),
    level: values.level,
    availability: formatAvailability(values.presets, values.availabilityOther),
    skills: values.skills,
  }
}

/** Rubriques modifiées par rapport aux valeurs de départ, dans l'ordre de la page. */
export function changedSections(initial, current, hasNewPhoto) {
  const same = (keys) => keys.every((key) => JSON.stringify(initial[key]) === JSON.stringify(current[key]))
  const sections = []
  if (hasNewPhoto) sections.push("photo")
  if (!same(["fullName", "city", "phone", "bio"])) sections.push("informations")
  if (!same(["school", "schoolOther", "level"])) sections.push("études")
  if (!same(["skills"])) sections.push("compétences")
  if (!same(["presets", "availabilityOther"])) sections.push("disponibilités")
  return sections
}

/**
 * Valide, envoie la photo si besoin, puis enregistre. Fonction à dépendances injectées (`upload`, `save`) :
 * testable sans réseau. Les champs sont conservés par l'appelant quelle que soit l'issue.
 * Reprise : si la photo a déjà été envoyée lors d'un essai précédent (`uploadedUrl`), elle n'est pas renvoyée, ce qui
 * évite une photo orpheline par essai. Toute issue après l'envoi renvoie `uploadedUrl` pour le prochain essai.
 * @param {{ values: object, avatarFile: File | null, uploadedUrl?: string | null }} input
 * @param {{ upload: (file: File) => Promise<string>, save: (data: object) => Promise<{ error?: string, errors?: object }> }} deps
 * @returns {Promise<{ kind: "invalid", errors: object } | { kind: "error", error: string, errors?: object, photo?: boolean, uploadedUrl?: string } | { kind: "done" }>}
 */
export async function submitStudentProfile({ values, avatarFile, uploadedUrl = null }, { upload, save }) {
  const payload = toPayload(values)
  const errors = validateStudentProfile(payload)
  if (values.school === OTHER_SCHOOL && !payload.school) errors.school = "Indiquez le nom de votre établissement."
  if (Object.keys(errors).length > 0) return { kind: "invalid", errors }

  let avatarUrl = avatarFile ? uploadedUrl || undefined : undefined
  if (avatarFile && !avatarUrl) {
    try {
      avatarUrl = await upload(avatarFile)
    } catch {
      return { kind: "error", error: ERR_AVATAR_UPLOAD, photo: true }
    }
  }
  const kept = avatarUrl ? { uploadedUrl: avatarUrl } : {}
  try {
    const result = await save({ ...payload, avatarUrl })
    if (result?.error) return { kind: "error", error: result.error, errors: result.errors, ...kept }
    return { kind: "done" }
  } catch {
    return { kind: "error", error: ERR_UNEXPECTED, ...kept }
  }
}

/**
 * Faut-il demander confirmation avant de suivre ce clic ? Seulement pour un lien interne, sans modificateur,
 * qui ne s'ouvre pas dans un autre onglet. Pur : testable sans navigateur.
 */
export function leavesPage({ anchor, event, origin }) {
  if (!anchor || event.defaultPrevented || event.button > 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (anchor.target && anchor.target !== "_self") return false
  if (anchor.hasAttribute?.("download")) return false
  const href = anchor.getAttribute?.("href") ?? ""
  if (!href || href.startsWith("#")) return false
  try {
    const url = new URL(href, origin)
    return url.origin === origin
  } catch {
    return false
  }
}

function useLeaveGuard(active) {
  useEffect(() => {
    if (!active) return undefined
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const onClick = (event) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null
      if (!leavesPage({ anchor, event, origin: window.location.origin })) return
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [active])
}

function Section({ title, sub, children }) {
  return (
    <section className="e2-sec" aria-label={title}>
      <div className="e2-sec__head">
        <div>
          <h2 className="e2-sec__title">{title}</h2>
          {sub ? <p className="e2-11-sub">{sub}</p> : null}
        </div>
      </div>
      <div className="e2-sec__body">{children}</div>
    </section>
  )
}

function FieldError({ id, error }) {
  if (!error) return null
  return (
    <div id={id} className="field__error" role="alert">
      <Icon name="i-alert-circle" />
      {error}
    </div>
  )
}

function PhotoPicker({ name, currentUrl, previewUrl, error, hasNewFile, disabled, onPick, onClear }) {
  const uid = useId()
  const inputRef = useRef(null)
  const shown = previewUrl || currentUrl
  const helpId = `${uid}-help`
  const errorId = `${uid}-error`
  return (
    <div className="field e2-span">
      <span className="field__label" id={`${uid}-label`}>
        Photo
        <span className="opt">(facultatif)</span>
      </span>
      <div className="e2-11-photo" role="group" aria-labelledby={`${uid}-label`}>
        <span className="av2">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Aperçu de la photo" />
          ) : (
            initialsOf(name)
          )}
        </span>
        <div className="e2-11-photo__txt">
          <button
            type="button"
            className="btn btn--soft btn--sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            aria-describedby={[helpId, error ? errorId : null].filter(Boolean).join(" ")}
          >
            <Icon name="i-image" />
            {shown ? "Changer la photo" : "Choisir une photo"}
          </button>
          {hasNewFile ? (
            <button type="button" className="e2-link e2-link--quiet" onClick={onClear} disabled={disabled}>
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
        <span>JPG, PNG ou WebP, 3 Mo au maximum.</span>
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  )
}

function ChipToggle({ selected, disabled, onToggle, children }) {
  return (
    <button
      type="button"
      className={selected ? "chip chip--sm is-selected" : "chip chip--sm"}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
    >
      {selected ? <Icon name="i-check" /> : null}
      {children}
    </button>
  )
}

function ClientPreview({ values, form, avatarSrc }) {
  const school = values.school === OTHER_SCHOOL ? values.schoolOther.trim() : values.school
  const details = [school, values.city].filter(Boolean).join(" · ")
  return (
    <section className="e2-sec" aria-label="Aperçu client">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Aperçu client</h2>
      </div>
      <div className="e2-sec__body">
        <div className="e2-who">
          <Avatar name={values.fullName || "Étudiant"} src={avatarSrc ?? undefined} />
          <div className="e2-10-who">
            <div className="e2-who__name">{publicDisplayName(values.fullName)}</div>
            {details ? <div className="e2-who__sub">{details}</div> : null}
          </div>
        </div>
        <p className="caption e2-muted">
          Un visiteur voit votre prénom et l&apos;initiale de votre nom. Votre téléphone n&apos;est jamais affiché.
        </p>
        <Link className="e2-link" href={publicTalentHref(form.values.userId)}>
          <Icon name="i-external" />
          Voir mon profil public
        </Link>
      </div>
    </section>
  )
}

/**
 * Formulaire de modification du profil étudiant (E11). La photo part du navigateur vers `avatars/<userId>/...`
 * (nom unique), puis seule son URL publique est transmise à `saveStudentProfile`, qui la valide. La carte
 * étudiante n'est plus gérée ici : le lien mène à la vérification. Les rubriques modifiées sont comptées dans la
 * barre d'enregistrement ; quitter la page avec des modifications demande confirmation.
 * @param {{ form: import("@/lib/actions/student-profile.actions").StudentProfileForm }} props
 */
export function StudentProfileForm({ form }) {
  const router = useRouter()
  const toast = useAppToast()
  const { supabase } = useSupabase()
  const initial = useMemo(() => initialValues(form), [form])
  const [values, setValues] = useState(initial)
  const [avatarFile, setAvatarFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [errors, setErrors] = useState({})
  const [photoError, setPhotoError] = useState("")
  const [formError, setFormError] = useState("")
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState(false)
  // Un second clic avant le retour du serveur ne relance jamais l'enregistrement.
  const busy = useRef(false)
  // Photo déjà téléversée lors d'un essai échoué : réutilisée au prochain essai tant que le fichier ne change pas.
  const uploaded = useRef(null)
  const uid = useId()

  const universityOptions = useMemo(
    () => [
      ...form.universities.map((u) => ({ value: u.name, label: u.shortName ? `${u.shortName} - ${u.name}` : u.name })),
      { value: OTHER_SCHOOL, label: "Autre établissement" },
    ],
    [form.universities],
  )
  // Compétences déjà enregistrées mais absentes de la liste proposée : elles restent visibles et décochables.
  const skillOptions = useMemo(
    () => [...SKILL_OPTIONS, ...form.values.skills.filter((skill) => !SKILL_OPTIONS.includes(skill))],
    [form.values.skills],
  )

  const sections = changedSections(initial, values, Boolean(avatarFile))
  const dirty = sections.length > 0 && !saved
  useLeaveGuard(dirty)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function change(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function toggleSkill(skill) {
    const has = values.skills.includes(skill)
    change("skills", has ? values.skills.filter((s) => s !== skill) : [...values.skills, skill])
    setErrors((current) => ({ ...current, skills: undefined }))
  }

  function togglePreset(preset) {
    const has = values.presets.includes(preset)
    change("presets", has ? values.presets.filter((p) => p !== preset) : [...values.presets, preset])
    setErrors((current) => ({ ...current, availability: undefined }))
  }

  function pickPhoto(file) {
    const problem = checkAvatarFile(file)
    setPhotoError(problem ?? "")
    if (problem) return
    uploaded.current = null
    setAvatarFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function clearPhoto() {
    uploaded.current = null
    setAvatarFile(null)
    setPreviewUrl("")
    setPhotoError("")
  }

  async function uploadPhoto(file) {
    const path = avatarPath(form.values.userId, file.type)
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
    const result = await submitStudentProfile(
      { values, avatarFile, uploadedUrl: uploaded.current },
      { upload: uploadPhoto, save: saveStudentProfile },
    )
    if (result.kind === "error" && result.uploadedUrl) uploaded.current = result.uploadedUrl
    busy.current = false
    setSending(false)

    if (result.kind === "invalid") {
      setErrors(result.errors)
      setFormError("Certains champs sont à corriger avant d'enregistrer.")
      return
    }
    if (result.kind === "error") {
      if (result.errors) setErrors(result.errors)
      if (result.photo) setPhotoError(result.error)
      else setFormError(result.error)
      return
    }
    // Plus de modifications en attente : la confirmation de départ ne doit pas bloquer la redirection.
    setSaved(true)
    toast.success("Profil enregistré", "Vos modifications sont à jour.")
    router.push(studentProfileHref())
    router.refresh()
  }

  const phoneHelpId = `${uid}-phone-help`
  const phoneErrorId = `${uid}-phone-error`
  const skillsId = `${uid}-skills`
  const availabilityId = `${uid}-availability`
  const skillsFull = values.skills.length >= SKILLS_MAX

  return (
    <div className="page2">
      <header className="e2-mtop">
        <Link className="iconbtn2" href={studentProfileHref()} aria-label="Retour à mon profil">
          <Icon name="i-arrow-left" />
        </Link>
        <span className="e2-mtop__title">Modifier mon profil</span>
        <span className="e2-mtop__spacer" />
      </header>
      <div className="e2-11-top">
        <PageHead
          date={
            <Link className="e2-back" href={studentProfileHref()}>
              <Icon name="i-arrow-left" />
              Mon profil
            </Link>
          }
          title="Modifier mon profil"
        />
        <p className="e2-lead">Les champs marqués d&apos;un astérisque sont obligatoires.</p>
      </div>
      <div className="e2-cols">
        <form className="e2-stack" onSubmit={onSubmit} noValidate>
          {formError ? (
            <div className="banner banner--erreur" role="alert">
              <Icon name="i-alert-circle" />
              <div className="banner__body">
                <div className="banner__title">Enregistrement impossible</div>
                {formError}
              </div>
            </div>
          ) : null}

          <Section title="Informations personnelles" sub="Visibles par les clients, sauf votre téléphone.">
            <div className="e2-form">
              <PhotoPicker
                name={values.fullName}
                currentUrl={form.values.avatarUrl}
                previewUrl={previewUrl}
                error={photoError}
                hasNewFile={Boolean(avatarFile)}
                disabled={sending}
                onPick={pickPhoto}
                onClear={clearPhoto}
              />
              <TextField
                label="Nom complet"
                required
                name="fullName"
                autoComplete="name"
                maxLength={NAME_MAX}
                value={values.fullName}
                onChange={(e) => change("fullName", e.target.value)}
                help="Votre prénom et votre nom."
                error={errors.fullName}
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
              <div className="field e2-span">
                <label className="field__label" htmlFor={`${uid}-phone`}>
                  Téléphone
                  <span className="req" aria-hidden="true">*</span>
                </label>
                <PhoneInput
                  id={`${uid}-phone`}
                  value={values.phone}
                  onChange={(e) => change("phone", e.target.value)}
                  invalid={Boolean(errors.phone)}
                  disabled={sending}
                  required
                  aria-describedby={`${phoneHelpId}${errors.phone ? ` ${phoneErrorId}` : ""}`}
                />
                <div id={phoneHelpId} className="field__help">
                  <span>Sert à vos retraits. Jamais affiché aux clients.</span>
                </div>
                <FieldError id={phoneErrorId} error={errors.phone} />
              </div>
              <TextareaField
                className="e2-span"
                label="Présentation"
                optional
                name="bio"
                maxLength={BIO_MAX}
                rows={4}
                value={values.bio}
                onChange={(e) => change("bio", e.target.value)}
                help="2 ou 3 phrases : vos études, votre expérience."
                error={errors.bio}
                disabled={sending}
              />
            </div>
          </Section>

          <Section title="Études" sub="Indiquez l'établissement où vous étudiez.">
            <div className="e2-form">
              <SelectField
                label="Établissement"
                optional
                name="school"
                options={universityOptions}
                value={values.school}
                onChange={(value) => change("school", value)}
                placeholder="Choisir un établissement"
                error={values.school === OTHER_SCHOOL ? undefined : errors.school}
                disabled={sending}
              />
              <SelectField
                label="Niveau d'études"
                optional
                name="level"
                options={LEVEL_OPTIONS}
                value={values.level}
                onChange={(value) => change("level", value)}
                placeholder="Choisir un niveau"
                error={errors.level}
                disabled={sending}
              />
              {values.school === OTHER_SCHOOL ? (
                <TextField
                  className="e2-span"
                  label="Nom de l'établissement"
                  required
                  name="schoolOther"
                  maxLength={SCHOOL_MAX}
                  value={values.schoolOther}
                  onChange={(e) => change("schoolOther", e.target.value)}
                  error={errors.school}
                  disabled={sending}
                />
              ) : null}
              <div className="field e2-span">
                <span className="field__label">Carte étudiante</span>
                <div className="e2-11-carte">
                  <Link className="e2-link" href={form.verification.action?.href ?? "/profile/verify"}>
                    <Icon name="i-shield" />
                    {form.verification.action?.label ?? "Gérer ma vérification"}
                  </Link>
                </div>
                <div className="field__help">
                  <span>{`Statut actuel : ${form.verification.label}.`}</span>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Compétences"
            sub={`Choisissez jusqu'à ${SKILLS_MAX} compétences : ${values.skills.length} sur ${SKILLS_MAX}.`}
          >
            <div className="chips" role="group" aria-label="Compétences" id={skillsId}>
              {skillOptions.map((skill) => {
                const selected = values.skills.includes(skill)
                return (
                  <ChipToggle
                    key={skill}
                    selected={selected}
                    disabled={sending || (skillsFull && !selected)}
                    onToggle={() => toggleSkill(skill)}
                  >
                    {missionTypeLabel(skill)}
                  </ChipToggle>
                )
              })}
            </div>
            <FieldError id={`${skillsId}-error`} error={errors.skills} />
          </Section>

          <Section title="Disponibilités" sub="Indicatif : les clients le voient sur votre profil.">
            <div className="chips" role="group" aria-label="Disponibilités" id={availabilityId}>
              {AVAILABILITY_PRESETS.map((preset) => (
                <ChipToggle
                  key={preset}
                  selected={values.presets.includes(preset)}
                  disabled={sending}
                  onToggle={() => togglePreset(preset)}
                >
                  {preset}
                </ChipToggle>
              ))}
            </div>
            <TextField
              label="Autre disponibilité"
              optional
              name="availabilityOther"
              maxLength={AVAILABILITY_OTHER_MAX}
              value={values.availabilityOther}
              onChange={(e) => change("availabilityOther", e.target.value)}
              help="Par exemple : mardi et jeudi après 17 h."
              error={errors.availability}
              disabled={sending}
            />
          </Section>

          <div className="e2-sec e2-11-save">
            <span className="e2-11-save__info" role="status">
              <Icon name={dirty ? "i-info" : "i-check"} />
              <span>
                <b>{dirty ? "Modifications non enregistrées" : "Aucune modification"}</b>
                {dirty ? <small>{sections.join(", ")}</small> : null}
              </span>
            </span>
            <Link className="btn btn--soft" href={studentProfileHref()}>
              Annuler
            </Link>
            <button type="submit" className="btn btn--dark" disabled={sending || !dirty}>
              {sending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
        <div className="e2-stack">
          <ClientPreview values={values} form={form} avatarSrc={previewUrl || form.values.avatarUrl} />
        </div>
      </div>
    </div>
  )
}

/**
 * Édition du profil étudiant (E11). `form` vient de `getStudentProfileForm` ; sans lecture fiable du profil,
 * le formulaire n'est pas rendu (il enverrait un téléphone vide et l'effacerait).
 * @param {{ form?: import("@/lib/actions/student-profile.actions").StudentProfileForm, error?: string }} props
 */
export function StudentProfileEditView({ form, error }) {
  if (error || !form) {
    return (
      <div className="page2">
        <ErrorState
          titleAs="h1"
          title="Impossible de charger votre profil"
          text="Le chargement a échoué. Vos données et votre argent ne sont pas touchés."
        />
      </div>
    )
  }
  return <StudentProfileForm form={form} />
}

export default StudentProfileEditView
