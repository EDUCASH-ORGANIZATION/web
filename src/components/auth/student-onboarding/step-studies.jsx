"use client"

import { Icon } from "@/components/design/icon"
import { AuthStepper } from "@/components/auth/ui/auth-stepper"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { AVAILABILITY_PRESETS, STUDY_LEVELS } from "@/lib/auth/schemas"
import { MISSION_TYPE_OPTIONS } from "@/lib/constants/missions"
import { STEP_LABELS, StepSubmit } from "./step-identity"

/** Valeur de l'option « autre établissement » dans la liste. */
export const OTHER_SCHOOL = "__other__"

function Chip({ selected, label, onToggle }) {
  return (
    <button type="button" className={`chip${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={onToggle}>
      {selected && <Icon name="i-check" />}
      {label}
    </button>
  )
}

function universityLabel({ name, short_name: shortName, city }) {
  return `${shortName ? `${shortName} · ${name}` : name}${city ? ` (${city})` : ""}`
}

function toggled(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/**
 * Étape 2 : établissement, niveau, compétences, disponibilités.
 * @param {{
 *   values: Record<string, any>,
 *   errors: Record<string, string>,
 *   universities: { id: string, name: string, short_name?: string | null, city?: string | null }[],
 *   formError?: string,
 *   onChange: (name: string, value: any) => void,
 *   onBack: () => void,
 *   onSubmit: () => void,
 * }} props
 */
export function StepStudies({ values, errors, universities, formError = "", onChange, onBack, onSubmit }) {
  function handleSubmit(event) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="auth__form" method="post" noValidate onSubmit={handleSubmit}>
      <AuthStepper steps={STEP_LABELS} current={2} />
      <div>
        <h1 className="ds-h1">Tes études et tes talents</h1>
        <p className="muted a-lead">Pour te proposer les bonnes missions.</p>
      </div>
      {formError && <FormBanner tone="erreur">{formError}</FormBanner>}

      <div className="field">
        <label className="field__label" htmlFor="o-etab">
          Établissement <span className="req">*</span>
        </label>
        <select
          className={`select${values.school ? "" : " is-placeholder"}${errors.school ? " is-error" : ""}`}
          id="o-etab"
          name="school"
          value={values.school}
          aria-invalid={errors.school ? true : undefined}
          aria-describedby={errors.school ? "o-etab-error" : undefined}
          onChange={(event) => onChange("school", event.target.value)}
        >
          <option value="">Choisir ton établissement</option>
          {universities.map((university) => (
            <option key={university.id} value={university.name}>
              {universityLabel(university)}
            </option>
          ))}
          <option value={OTHER_SCHOOL}>Autre établissement</option>
        </select>
        {values.school === OTHER_SCHOOL && (
          <input
            className={`input${errors.school ? " is-error" : ""}`}
            name="schoolOther"
            placeholder="Nom de ton établissement"
            aria-label="Nom de ton établissement"
            value={values.schoolOther}
            onChange={(event) => onChange("schoolOther", event.target.value)}
          />
        )}
        <FieldError id="o-etab-error" message={errors.school} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="o-niv">
          Niveau d&apos;études <span className="req">*</span>
        </label>
        <select
          className={`select${values.level ? "" : " is-placeholder"}${errors.level ? " is-error" : ""}`}
          id="o-niv"
          name="level"
          value={values.level}
          aria-invalid={errors.level ? true : undefined}
          aria-describedby={errors.level ? "o-niv-error" : undefined}
          onChange={(event) => onChange("level", event.target.value)}
        >
          <option value="">Choisir ton niveau</option>
          {STUDY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <FieldError id="o-niv-error" message={errors.level} />
      </div>

      <div className="field" role="group" aria-labelledby="o-skills-label">
        <span className="field__label" id="o-skills-label">
          Compétences <span className="req">*</span>
        </span>
        <span className="field__help">Choisis au moins une compétence.</span>
        <div className="chips">
          {MISSION_TYPE_OPTIONS.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              selected={values.skills.includes(value)}
              onToggle={() => onChange("skills", toggled(values.skills, value))}
            />
          ))}
        </div>
        <FieldError id="o-skills-error" message={errors.skills} />
      </div>

      <div className="field" role="group" aria-labelledby="o-dispo-label">
        <span className="field__label" id="o-dispo-label">
          Disponibilités <span className="opt">facultatif</span>
        </span>
        <div className="chips">
          {AVAILABILITY_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={preset}
              selected={values.availability.includes(preset)}
              onToggle={() => onChange("availability", toggled(values.availability, preset))}
            />
          ))}
        </div>
        <FieldError id="o-dispo-error" message={errors.availability} />
      </div>

      <div className="row row--between">
        <button className="btn btn--secondary" type="button" onClick={onBack}>
          <Icon name="i-arrow-left" />
          Retour
        </button>
        <span className="ds-grow" />
        <StepSubmit>Continuer</StepSubmit>
      </div>
    </form>
  )
}
