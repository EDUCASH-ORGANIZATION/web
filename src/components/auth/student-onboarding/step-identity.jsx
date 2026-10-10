"use client"

import { useRef } from "react"
import { Icon } from "@/components/design/icon"
import { AuthStepper } from "@/components/auth/ui/auth-stepper"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { useHydrated } from "@/components/auth/ui/hydrated-submit"
import { PhoneInput } from "@/components/auth/ui/phone-input"
import { CITIES } from "@/lib/supabase/database.constants"
import { BIO_MAX } from "@/lib/auth/schemas"

export const STEP_LABELS = ["Identité", "Études", "Carte étudiante"]

/**
 * Bouton d'envoi des étapes : inactif tant que la page n'est pas hydratée (aucun envoi natif
 * possible avant que le JavaScript soit prêt) ; le point fléché reste un enfant direct du bouton.
 */
export function StepSubmit({ children, pending = false, block = false }) {
  const hydrated = useHydrated()
  return (
    <button
      type="submit"
      className={`btn btn--primary${block ? " btn--block" : ""}${pending ? " is-loading" : ""}`}
      disabled={!hydrated}
      aria-busy={pending || undefined}
    >
      {children}
      <span className="btn__dot">
        <Icon name="i-arrow-right" />
      </span>
    </button>
  )
}

function describedBy(id, errors, name, extra) {
  return [errors[name] ? `${id}-error` : null, extra].filter(Boolean).join(" ") || undefined
}

/**
 * Étape 1 : photo, nom, ville, téléphone, bio.
 * @param {{
 *   values: Record<string, any>,
 *   errors: Record<string, string>,
 *   avatar: { name: string, previewUrl: string | null } | null,
 *   avatarError?: string,
 *   formError?: string,
 *   onChange: (name: string, value: any) => void,
 *   onPickAvatar: (file: File | null) => void,
 *   onSubmit: () => void,
 * }} props
 */
export function StepIdentity({ values, errors, avatar, avatarError = "", formError = "", onChange, onPickAvatar, onSubmit }) {
  const fileRef = useRef(null)
  const bioLength = (values.bio ?? "").length

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="auth__form" method="post" noValidate onSubmit={handleSubmit}>
      <AuthStepper steps={STEP_LABELS} current={1} />
      <div>
        <h1 className="ds-h1">Qui es-tu ?</h1>
        <p className="muted a-lead">
          Les champs marqués <span className="a-err-text">*</span> sont obligatoires.
        </p>
      </div>
      {formError && <FormBanner tone="erreur">{formError}</FormBanner>}

      <div className="field">
        <span className="field__label">
          Photo <span className="opt">facultatif</span>
        </span>
        <div className="a-photo">
          <span className="avatar avatar--xl avatar--empty">
            {avatar?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="h-full w-full rounded-full object-cover" src={avatar.previewUrl} alt="Aperçu de ta photo" />
            ) : (
              <Icon name="i-user" className="ic ic--32" />
            )}
          </span>
          <div className="stack stack--2">
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png"
              tabIndex={-1}
              aria-label="Choisir une photo de profil"
              onChange={(event) => {
                onPickAvatar(event.target.files?.[0] ?? null)
                event.target.value = ""
              }}
            />
            <button className="btn btn--secondary btn--sm" type="button" onClick={() => fileRef.current?.click()}>
              <Icon name="i-image" />
              {avatar ? "Changer la photo" : "Ajouter une photo"}
            </button>
            <span className="caption">JPG ou PNG, 10 Mo max.</span>
          </div>
        </div>
        <FieldError id="o-photo-error" message={avatarError || errors.avatarUrl} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="o-nom">
          Nom complet <span className="req">*</span>
        </label>
        <input
          className={`input${errors.fullName ? " is-error" : ""}`}
          id="o-nom"
          name="fullName"
          placeholder="Ex. Sèna Agossou"
          autoComplete="name"
          value={values.fullName}
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={describedBy("o-nom", errors, "fullName")}
          onChange={(event) => onChange("fullName", event.target.value)}
        />
        <FieldError id="o-nom-error" message={errors.fullName} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="o-ville">
          Ville <span className="req">*</span>
        </label>
        <select
          className={`select${values.city ? "" : " is-placeholder"}${errors.city ? " is-error" : ""}`}
          id="o-ville"
          name="city"
          value={values.city}
          aria-invalid={errors.city ? true : undefined}
          aria-describedby={describedBy("o-ville", errors, "city")}
          onChange={(event) => onChange("city", event.target.value)}
        >
          <option value="">Choisir ta ville</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        <FieldError id="o-ville-error" message={errors.city} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="o-tel">
          Téléphone <span className="req">*</span>
        </label>
        <PhoneInput
          id="o-tel"
          value={values.phone}
          invalid={Boolean(errors.phone)}
          aria-describedby={describedBy("o-tel", errors, "phone", "o-tel-help")}
          onChange={(event) => onChange("phone", event.target.value)}
        />
        {errors.phone ? (
          <FieldError id="o-tel-error" message={errors.phone} />
        ) : (
          <span className="field__help" id="o-tel-help">
            10 chiffres, commence par 01. Ex. 01 97 45 21 08
          </span>
        )}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="o-bio">
          Bio courte <span className="opt">facultatif</span>
        </label>
        <textarea
          className={`input${errors.bio ? " is-error" : ""}`}
          id="o-bio"
          name="bio"
          maxLength={BIO_MAX}
          placeholder="Ce que tu sais faire, en une ou deux phrases"
          value={values.bio}
          aria-invalid={errors.bio ? true : undefined}
          aria-describedby={describedBy("o-bio", errors, "bio")}
          onChange={(event) => onChange("bio", event.target.value)}
        />
        <FieldError id="o-bio-error" message={errors.bio} />
        <span className="field__help">
          <span>Visible par les clients.</span>
          <span className="field__count">
            {bioLength} / {BIO_MAX}
          </span>
        </span>
      </div>

      <div className="row row--between">
        <span className="ds-grow" />
        <StepSubmit>Continuer</StepSubmit>
      </div>
    </form>
  )
}
