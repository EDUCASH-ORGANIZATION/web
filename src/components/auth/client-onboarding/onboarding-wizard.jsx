"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AuthStepper } from "@/components/auth/ui/auth-stepper"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { Icon } from "@/components/design/icon"
import { useSupabase } from "@/components/shared/supabase-provider"
import { completeClientOnboarding } from "@/lib/actions/onboarding.actions"
import { withNext } from "@/lib/auth/destinations"
import { CLIENT_TYPES, makeClientIdentitySchema } from "@/lib/auth/schemas"
import { ReadyScreen } from "./ready-screen"
import { StepIdentity } from "./step-identity"
import { StepType } from "./step-type"

const STEPS = ["Type de compte", "Identité"]
const DRAFT_KEY = "ec_client_onboarding"
const BASE_PATH = "/auth/register/client"
const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }
const TYPE_MISSING = "Choisissez votre profil."
const SAVE_FAILED = "Un souci de notre côté. Vos informations sont conservées, réessayez."

const EMPTY_VALUES = { name: "", city: "", phone: "" }

/**
 * Étape atteignable : l'étape 2 exige un type choisi, sinon retour à l'étape 1.
 * @param {unknown} requested étape demandée (nombre ou texte de l'URL)
 * @param {{ type?: string }} state
 * @returns {1 | 2}
 */
export function reachableStep(requested, { type } = {}) {
  const wanted = Number(requested) === 2 ? 2 : 1
  if (wanted === 2 && !CLIENT_TYPES.includes(type)) return 1
  return wanted
}

function readDraft() {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? "null")
    if (!raw || typeof raw !== "object") return null
    const text = (value) => (typeof value === "string" ? value : "")
    return {
      type: CLIENT_TYPES.includes(raw.type) ? raw.type : "",
      values: { name: text(raw.name), city: text(raw.city), phone: text(raw.phone) },
    }
  } catch {
    return null
  }
}

function writeDraft(draft) {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    else window.sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Stockage indisponible : les saisies ne survivent simplement pas au rechargement.
  }
}

/**
 * Assistant d'onboarding client : étape 1 (type), étape 2 (identité), puis écran final.
 * Le navigateur n'écrit jamais `profiles` : le logo part vers Storage, le reste
 * passe par l'action serveur `completeClientOnboarding`.
 * @param {{ userId: string, next?: string, initialStep?: number }} props
 */
export function OnboardingWizard({ userId, next, initialStep = 1 }) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState("")
  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState("")
  const [stepRequest, setStepRequest] = useState(initialStep)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState("")
  const [destination, setDestination] = useState("")
  const logoInputRef = useRef(null)
  const restored = useRef(false)

  const step = reachableStep(stepRequest, { type })

  // Brouillon du texte (jamais le fichier) : restauré une fois après le montage, puis enregistré.
  useEffect(() => {
    const draft = readDraft()
    if (draft) {
      setType(draft.type)
      setValues(draft.values)
    }
    restored.current = true
  }, [])

  useEffect(() => {
    if (!restored.current) return
    writeDraft({ type, ...values })
  }, [type, values])

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  function goTo(target) {
    setStepRequest(target)
    router.replace(withNext(`${BASE_PATH}?etape=${target}`, next), { scroll: false })
  }

  function chooseType(value) {
    setType(value)
    setErrors({})
  }

  function changeValue(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleLogoFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!LOGO_EXTENSIONS[file.type]) {
      setErrors((current) => ({ ...current, avatarUrl: "Choisissez une image PNG, JPG ou WebP." }))
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setErrors((current) => ({ ...current, avatarUrl: "Cette image dépasse 5 Mo. Choisissez-en une plus légère." }))
      return
    }
    setErrors((current) => ({ ...current, avatarUrl: undefined }))
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function removeLogo() {
    setLogoFile(null)
    setLogoPreview("")
  }

  async function uploadLogo() {
    if (!logoFile) return ""
    const path = `${userId}/avatar.${LOGO_EXTENSIONS[logoFile.type]}`
    const { error } = await supabase.storage.from("avatars").upload(path, logoFile, { upsert: true })
    if (error) throw error
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl
  }

  function submitType() {
    if (!CLIENT_TYPES.includes(type)) {
      setErrors({ clientType: TYPE_MISSING })
      return
    }
    setErrors({})
    goTo(2)
  }

  function submitIdentity() {
    const parsed = makeClientIdentitySchema().safeParse(values)
    if (!parsed.success) {
      const fieldErrors = {}
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0]] ??= issue.message
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setFormError("")

    startTransition(async () => {
      let avatarUrl = ""
      try {
        avatarUrl = await uploadLogo()
      } catch {
        setErrors({ avatarUrl: "Le logo n'a pas pu être envoyé. Réessayez ou retirez-le." })
        return
      }

      const result = await completeClientOnboarding({ clientType: type, ...values, avatarUrl, next })
      if (!result?.ok) {
        setErrors(result?.fieldErrors ?? {})
        if (result?.fieldErrors?.clientType) goTo(1)
        setFormError(result?.fieldErrors ? "" : (result?.message ?? SAVE_FAILED))
        return
      }
      writeDraft(null)
      setDestination(result.destination)
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (step === 1) submitType()
    else submitIdentity()
  }

  if (destination) return <ReadyScreen destination={destination} />

  return (
    <form className="auth__form" method="post" noValidate onSubmit={handleSubmit}>
      <AuthStepper steps={STEPS} current={step} />
      <div>
        <h1 className="ds-h1">{step === 1 ? "Bienvenue sur EduCash" : "Votre identité"}</h1>
        <p className="muted a-lead">
          {step === 1 ? "Pour qui publiez-vous des missions ?" : "Ce que verront les étudiants sur vos missions."}
        </p>
      </div>

      {step === 1 ? (
        <StepType value={type} error={errors.clientType} onChange={chooseType} />
      ) : (
        <StepIdentity
          type={type}
          values={values}
          errors={errors}
          logoPreview={logoPreview}
          logoInputRef={logoInputRef}
          onChange={changeValue}
          onChangeType={() => goTo(1)}
          onPickLogo={() => logoInputRef.current?.click()}
          onLogoChange={handleLogoFile}
          onRemoveLogo={removeLogo}
        />
      )}

      {formError && (
        <FormBanner tone="erreur" title="Profil non enregistré">
          {formError}
        </FormBanner>
      )}

      {step === 1 ? (
        <HydratedSubmit pending={pending}>Continuer</HydratedSubmit>
      ) : (
        <div className="row row--between">
          <button className="btn btn--secondary" type="button" onClick={() => goTo(1)} disabled={pending}>
            <Icon name="i-arrow-left" />
            Retour
          </button>
          <span className="ds-grow" />
          <HydratedSubmit pending={pending} className="btn btn--primary">
            Créer mon profil
          </HydratedSubmit>
        </div>
      )}
    </form>
  )
}
