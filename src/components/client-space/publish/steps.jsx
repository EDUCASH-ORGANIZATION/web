"use client"

import { useId, useRef } from "react"
import { Icon } from "@/components/design/icon"
import { AmountField, CheckboxField, SelectField, TextField, TextareaField } from "@/components/app-ui/fields"
import { chipKeyAction } from "@/components/app-ui/interactive-logic"
import { CITIES, MIN_MISSION_BUDGET } from "@/lib/supabase/database.constants"
import { MISSION_TYPE_OPTIONS } from "@/lib/constants/missions"
import { formatAmount } from "@/lib/app/format"
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TITLE_MAX,
  URGENCY_OPTIONS,
  maxDeadline,
  typeIcon,
} from "@/lib/client-space/publish-schema"
import { LiveSummary } from "./publish-recap"

const CITY_OPTIONS = CITIES.map((city) => ({ value: city, label: city }))

/**
 * Groupe à choix unique au clavier (flèches, Début, Fin) : un seul arrêt de tabulation, le choix suit le focus.
 * `variant` "chip" : puces avec icône ; "choice" : cartes de choix (titre et précision).
 */
function ChoiceGroup({ label, options, value, onChange, variant, error }) {
  const uid = useId()
  const labelId = `${uid}-label`
  const errorId = error ? `${uid}-error` : undefined
  const refs = useRef([])
  const selectedIndex = options.findIndex((o) => o.value === value)
  const tabbable = selectedIndex >= 0 ? selectedIndex : 0

  function onKeyDown(event, index) {
    const action = chipKeyAction({ key: event.key, linked: false, count: options.length, at: index })
    if (!action) return
    event.preventDefault()
    refs.current[action.index]?.focus()
    onChange(options[action.index].value)
  }

  return (
    <div className="field">
      <span className="field__label" id={labelId}>
        {label}
        <span className="req" aria-hidden="true">*</span>
      </span>
      <div className="wizard2__choices2">
        <div
          className={variant === "chip" ? "chips" : "ds-grid ds-grid--3"}
          role="radiogroup"
          aria-labelledby={labelId}
          aria-describedby={errorId}
          aria-required="true"
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex
            const common = {
              ref: (node) => {
                refs.current[index] = node
              },
              type: "button",
              role: "radio",
              "aria-checked": selected,
              tabIndex: index === tabbable ? 0 : -1,
              "data-invalid": error && index === tabbable ? "true" : undefined,
              onClick: () => onChange(option.value),
              onKeyDown: (event) => onKeyDown(event, index),
            }
            if (variant === "chip") {
              return (
                <button key={option.value} {...common} className={selected ? "chip is-selected" : "chip"}>
                  <Icon name={typeIcon(option.value)} />
                  {option.label}
                </button>
              )
            }
            return (
              <button key={option.value} {...common} className={selected ? "choice is-selected" : "choice"}>
                <span>
                  <span className="choice__title">{option.label}</span>
                  <span className="choice__sub">{option.sub}</span>
                </span>
                <span className="choice__mark" aria-hidden="true" />
              </button>
            )
          })}
        </div>
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
 * Étape 1 : le besoin (type de mission et titre).
 * @param {{ values: object, errors: Record<string, string>, onChange: (field: string, value: unknown) => void }} props
 */
export function StepNeed({ values, errors, onChange }) {
  const { type: selectedType } = values
  const { type: typeError } = errors
  return (
    <>
      <div className="sec2">
        <h2 className="sec2__title">Le besoin</h2>
      </div>
      <ChoiceGroup
        label="Type de mission"
        variant="chip"
        options={MISSION_TYPE_OPTIONS}
        value={selectedType}
        onChange={(v) => onChange("type", v)}
        error={typeError}
      />
      <TextField
        label="Titre de la mission"
        required
        value={values.title}
        maxLength={TITLE_MAX}
        placeholder="Ex. Traduire un flyer en anglais"
        autoComplete="off"
        help={`Ce que l'étudiant lit en premier. ${values.title.length} / ${TITLE_MAX}`}
        error={errors.title}
        onChange={(event) => onChange("title", event.target.value)}
      />
    </>
  )
}

/**
 * Case « Mission avec achats » (tous les types de mission). Vrai `<input type="checkbox">` relié à une région
 * annoncée (`aria-controls`, `aria-expanded`) qui précise ce que la case implique, sans rien promettre de plus.
 */
function PurchasesToggle({ checked, error, onChange }) {
  const regionId = useId()
  return (
    <div className="wizard2__purchases">
      <CheckboxField
        label="Mission avec achats"
        help="L'étudiant achète des articles pour vous, par exemple au marché ou en boutique."
        checked={checked}
        error={error}
        aria-controls={regionId}
        aria-expanded={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div id={regionId} aria-live="polite">
        {checked ? (
          <p className="note2">
            <Icon name="i-info" />
            <span>
              Vous indiquerez une estimation des achats à l&apos;étape suivante. Elle est indicative : les achats ne sont
              pas bloqués et ne s&apos;ajoutent pas au budget bloqué.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Étape 2 : détails (description, ville et case « Mission avec achats »).
 * @param {{ values: object, errors: Record<string, string>, onChange: (field: string, value: unknown) => void }} props
 */
export function StepDetails({ values, errors, onChange }) {
  return (
    <>
      <div className="sec2">
        <h2 className="sec2__title">Détails</h2>
      </div>
      <TextareaField
        label="Description"
        required
        rows={5}
        value={values.description}
        maxLength={DESCRIPTION_MAX}
        placeholder="Les tâches, les horaires, ce que vous fournissez"
        help={`Tâches, horaires, ce qui est fourni. ${DESCRIPTION_MIN} caractères minimum.`}
        error={errors.description}
        onChange={(event) => onChange("description", event.target.value)}
      />
      <SelectField
        label="Ville"
        required
        options={CITY_OPTIONS}
        value={values.city}
        placeholder="Choisissez une ville"
        error={errors.city}
        onChange={(v) => onChange("city", v)}
      />
      <PurchasesToggle
        checked={values.avecAchats === true}
        error={errors.avecAchats}
        onChange={(checked) => onChange("avecAchats", checked)}
      />
    </>
  )
}

/**
 * Étape 3 : budget, urgence et date limite. `today` est la date du jour au Bénin (AAAA-MM-JJ).
 * @param {{ values: object, errors: Record<string, string>, today: string, onChange: (field: string, value: unknown) => void }} props
 */
export function StepBudget({ values, errors, today, onChange }) {
  return (
    <>
      <div className="sec2">
        <h2 className="sec2__title">Budget et échéance</h2>
      </div>
      <div className="field-grid2">
        <AmountField
          label="Budget"
          required
          value={values.budget}
          onChange={(v) => onChange("budget", v)}
          help={
            values.avecAchats === true
              ? `Minimum ${formatAmount(MIN_MISSION_BUDGET)}. C'est le montant du service : seul ce budget est bloqué.`
              : `Minimum ${formatAmount(MIN_MISSION_BUDGET)}. Vous payez ce montant, rien de plus.`
          }
          error={errors.budget}
        />
        <TextField
          label="Date limite"
          required
          type="date"
          value={values.deadline}
          min={today}
          max={maxDeadline(today)}
          help="Échéance dépassée sans étudiant retenu : examinez les candidatures ou annulez la mission."
          error={errors.deadline}
          onChange={(event) => onChange("deadline", event.target.value)}
        />
      </div>
      {values.avecAchats === true ? (
        <AmountField
          label="Estimation des achats"
          required
          value={values.estimationAchats}
          onChange={(v) => onChange("estimationAchats", v)}
          help="Montant indicatif des articles à acheter. Il n'est pas bloqué et ne donne lieu à aucune commission."
          error={errors.estimationAchats}
        />
      ) : null}
      <ChoiceGroup
        label="Urgence"
        variant="choice"
        options={URGENCY_OPTIONS}
        value={values.urgency}
        onChange={(v) => onChange("urgency", v)}
        error={errors.urgency}
      />
    </>
  )
}

const TIPS = {
  1: { title: "Un bon titre", items: ["Un verbe d'action", "Le lieu ou « à distance »", "Pas de numéro de téléphone"] },
  2: {
    title: "Ce que les étudiants regardent",
    items: ["Des tâches concrètes", "Les horaires ou le volume", "Ce que vous fournissez"],
  },
}

/** Colonne de droite des étapes 1 et 2 : conseils de rédaction. */
export function TipsAside({ step }) {
  const tips = TIPS[step]
  if (!tips) return null
  return (
    <section className="card2" aria-label={tips.title}>
      <div className="sec2">
        <h2 className="sec2__title">{tips.title}</h2>
      </div>
      <ul className="checklist">
        {tips.items.map((item) => (
          <li key={item} className="is-ok">
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Colonne de droite de l'étape 3 : répartition en direct du budget. */
export function BudgetAside({ budget, purchases = null }) {
  return <LiveSummary budget={budget} purchases={purchases} />
}
