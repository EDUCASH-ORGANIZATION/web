"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSupabase } from "@/components/shared/supabase-provider"
import { completeStudentOnboarding } from "@/lib/actions/onboarding.actions"
import { makeStudentIdentitySchema, makeStudentStudiesSchema } from "@/lib/auth/schemas"
import { withNext } from "@/lib/auth/destinations"
import { StepIdentity } from "./step-identity"
import { OTHER_SCHOOL, StepStudies } from "./step-studies"
import { AVATAR_TYPES, CARD_TYPES, StepCard, validateUpload } from "./step-card"
import { WelcomeScreen } from "./welcome-screen"
import { LAST_STEP, parseStep } from "./wizard-steps"

export const ONBOARDING_PATH = "/auth/register/student"
export { LAST_STEP, parseStep }

export const EMPTY_VALUES = {
  fullName: "",
  city: "",
  phone: "",
  bio: "",
  school: "",
  schoolOther: "",
  level: "",
  skills: [],
  availability: [],
}

const FIELD_STEP = {
  fullName: 1,
  city: 1,
  phone: 1,
  bio: 1,
  avatarUrl: 1,
  school: 2,
  level: 2,
  skills: 2,
  availability: 2,
  cardUrl: 3,
}

const SAVE_ERROR = "Nous n'avons pas pu enregistrer ton profil. Réessaie dans un instant."
const UPLOAD_ERROR = "L'envoi du fichier a échoué. Vérifie ta connexion puis réessaie."

/** Clé de sessionStorage du brouillon (champs texte seulement, jamais les fichiers). */
export function draftKey(userId) {
  return `ec_onboarding_student_${userId}`
}

/** Établissement saisi : la liste, ou le texte libre si « Autre établissement ». */
export function resolveSchool(values) {
  return values.school === OTHER_SCHOOL ? values.schoolOther.trim() : values.school
}

function identityInput(values) {
  return { fullName: values.fullName, city: values.city, phone: values.phone, bio: values.bio }
}

function studiesInput(values) {
  return { school: resolveSchool(values), level: values.level, skills: values.skills, availability: values.availability }
}

function firstIssues(result) {
  if (result.success) return {}
  const errors = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form")
    if (!(key in errors)) errors[key] = issue.message
  }
  return errors
}

/**
 * Valide les champs d'une étape avec les schémas partagés avec le serveur.
 * L'étape 3 n'a aucun champ obligatoire (carte facultative).
 * @returns {Record<string, string>} une erreur par champ, vide si l'étape est valide
 */
export function validateStep(step, values) {
  if (step === 1) return firstIssues(makeStudentIdentitySchema().safeParse(identityInput(values)))
  if (step === 2) return firstIssues(makeStudentStudiesSchema().safeParse(studiesInput(values)))
  return {}
}

/** Première étape incomplète avant `LAST_STEP`, ou `LAST_STEP` si les étapes 1 et 2 sont valides. */
export function firstIncompleteStep(values) {
  for (let step = 1; step < LAST_STEP; step += 1) {
    if (Object.keys(validateStep(step, values)).length > 0) return step
  }
  return LAST_STEP
}

/** Une étape non atteignable renvoie à la première étape incomplète. */
export function reachableStep(requested, values) {
  return Math.min(parseStep(requested), firstIncompleteStep(values))
}

/** Étape qui porte le premier champ en erreur (retour du serveur). */
export function stepOfFirstError(fieldErrors) {
  const steps = Object.keys(fieldErrors ?? {}).map((key) => FIELD_STEP[key] ?? LAST_STEP)
  return steps.length > 0 ? Math.min(...steps) : null
}

/** Brouillon relu : seules les clés connues, avec des types sûrs. */
export function sanitizeDraft(raw) {
  if (!raw || typeof raw !== "object") return null
  const draft = { ...EMPTY_VALUES }
  for (const key of Object.keys(EMPTY_VALUES)) {
    const value = raw[key]
    if (Array.isArray(EMPTY_VALUES[key])) {
      draft[key] = Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
    } else if (typeof value === "string") {
      draft[key] = value
    }
  }
  return draft
}

function readDraft(userId) {
  try {
    return sanitizeDraft(JSON.parse(window.sessionStorage.getItem(draftKey(userId))))
  } catch {
    return null
  }
}

function writeDraft(userId, values) {
  try {
    window.sessionStorage.setItem(draftKey(userId), JSON.stringify(values))
  } catch {
    // Stockage indisponible : les saisies restent en mémoire pour la session de l'onglet.
  }
}

function clearDraft(userId) {
  try {
    window.sessionStorage.removeItem(draftKey(userId))
  } catch {
    // Rien à nettoyer.
  }
}

function extensionOf(file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : ""
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg"
}

async function uploadFile(supabase, bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/**
 * Assistant d'onboarding étudiant : 3 étapes (`?etape=`) puis l'écran Bienvenue.
 * Les fichiers partent vers Storage sous `${userId}/`, puis l'action serveur écrit le profil.
 * @param {{
 *   userId: string,
 *   next?: string | null,
 *   initialStep?: number,
 *   initialValues?: Partial<typeof EMPTY_VALUES>,
 *   universities: { id: string, name: string, short_name?: string | null, city?: string | null }[],
 * }} props
 */
export function OnboardingWizard({ userId, next = null, initialStep = 1, initialValues = {}, universities }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { supabase } = useSupabase()

  const [values, setValues] = useState({ ...EMPTY_VALUES, ...initialValues })
  const [restored, setRestored] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState("")
  const [avatar, setAvatar] = useState(null)
  const [card, setCard] = useState(null)
  const [avatarError, setAvatarError] = useState("")
  const [cardError, setCardError] = useState("")
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(null)
  const previewRef = useRef(null)

  const requested = searchParams?.get("etape") ?? initialStep
  const step = reachableStep(requested, values)

  // Brouillon de la session : champs texte uniquement.
  useEffect(() => {
    const draft = readDraft(userId)
    if (draft) setValues((current) => ({ ...current, ...draft }))
    setRestored(true)
  }, [userId])

  useEffect(() => {
    if (restored) writeDraft(userId, values)
  }, [restored, userId, values])

  // Garde l'URL cohérente avec l'étape réellement atteignable.
  useEffect(() => {
    if (restored && !done && parseStep(requested) !== step) goTo(step)
    // goTo ne dépend que de `next` et du routeur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, done, requested, step])

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    []
  )

  function goTo(target) {
    router.replace(withNext(`${ONBOARDING_PATH}?etape=${target}`, next), { scroll: true })
  }

  function handleChange(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    if (errors[name] || (name === "schoolOther" && errors.school)) {
      setErrors((current) => {
        const rest = { ...current }
        delete rest[name]
        if (name === "schoolOther") delete rest.school
        return rest
      })
    }
  }

  function handlePickAvatar(file) {
    if (!file) return
    const problem = validateUpload(file, AVATAR_TYPES, "photo")
    setAvatarError(problem)
    if (problem) return
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = URL.createObjectURL(file)
    setAvatar({ file, name: file.name, previewUrl: previewRef.current })
  }

  function handlePickCard(file) {
    if (!file) return
    const problem = validateUpload(file, CARD_TYPES, "carte")
    setCardError(problem)
    if (!problem) setCard({ file, name: file.name })
  }

  function advance(from) {
    const found = validateStep(from, values)
    setErrors(found)
    setFormError("")
    if (Object.keys(found).length === 0) goTo(from + 1)
  }

  async function finish({ withCard }) {
    if (pending) return
    const missing = firstIncompleteStep(values)
    if (missing < LAST_STEP) {
      setErrors(validateStep(missing, values))
      goTo(missing)
      return
    }
    setPending(true)
    setFormError("")
    setCardError("")
    const sendCard = withCard && card

    let avatarUrl
    let cardUrl
    try {
      if (avatar) avatarUrl = await uploadFile(supabase, "avatars", `${userId}/avatar.${extensionOf(avatar.file)}`, avatar.file)
      if (sendCard) cardUrl = await uploadFile(supabase, "student-cards", `${userId}/card.${extensionOf(card.file)}`, card.file)
    } catch {
      setFormError(UPLOAD_ERROR)
      setPending(false)
      return
    }

    let result
    try {
      result = await completeStudentOnboarding({
        ...identityInput(values),
        ...studiesInput(values),
        avatarUrl,
        cardUrl,
        next,
      })
    } catch {
      result = { ok: false, message: SAVE_ERROR }
    }
    setPending(false)

    if (result?.code === "already_done" && result.destination) {
      router.replace(result.destination)
      return
    }
    if (!result?.ok) {
      const fieldErrors = result?.fieldErrors ?? {}
      setErrors(fieldErrors)
      setFormError(result?.message ?? SAVE_ERROR)
      const target = stepOfFirstError(fieldErrors)
      if (target && target !== step) goTo(target)
      return
    }
    clearDraft(userId)
    setDone({ destination: result.destination, cardSent: Boolean(cardUrl) })
  }

  if (done) {
    return <WelcomeScreen fullName={values.fullName} cardSent={done.cardSent} destination={done.destination} />
  }

  if (step === 2) {
    return (
      <StepStudies
        values={values}
        errors={errors}
        universities={universities}
        formError={formError}
        onChange={handleChange}
        onBack={() => goTo(1)}
        onSubmit={() => advance(2)}
      />
    )
  }
  if (step === 3) {
    return (
      <StepCard
        card={card}
        cardError={cardError}
        formError={formError}
        pending={pending}
        onPickCard={handlePickCard}
        onBack={() => goTo(2)}
        onSubmit={() => finish({ withCard: true })}
        onSkip={() => finish({ withCard: false })}
      />
    )
  }
  return (
    <StepIdentity
      values={values}
      errors={errors}
      avatar={avatar}
      avatarError={avatarError}
      formError={formError}
      onChange={handleChange}
      onPickAvatar={handlePickAvatar}
      onSubmit={() => advance(1)}
    />
  )
}
