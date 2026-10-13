"use client"

import { useId, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Select } from "@/components/design/select"
import { formatAmountInput, parseAmountInput } from "./interactive-logic"

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Identifiants reliés : libellé (htmlFor), aide et erreur (aria-describedby).
function useFieldIds(id, help, error) {
  const uid = useId()
  const inputId = id ?? `${uid}-input`
  const helpId = help ? `${uid}-help` : undefined
  const errorId = error ? `${uid}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined
  return { inputId, helpId, errorId, describedBy }
}

function FieldLabel({ htmlFor, id, label, required, optional }) {
  return (
    <label className="field__label" htmlFor={htmlFor} id={id}>
      {label}
      {required ? <span className="req" aria-hidden="true">*</span> : null}
      {optional ? <span className="opt">(facultatif)</span> : null}
    </label>
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

function FieldHelp({ id, help, children }) {
  if (!help && !children) return null
  return (
    <div id={id} className="field__help">
      {help ? <span>{help}</span> : null}
      {children}
    </div>
  )
}

export function TextField({ id, label, help, error, required, optional, className, ...inputProps }) {
  const { inputId, helpId, errorId, describedBy } = useFieldIds(id, help, error)
  return (
    <div className={cx("field", className)}>
      <FieldLabel htmlFor={inputId} label={label} required={required} optional={optional} />
      <input
        {...inputProps}
        id={inputId}
        className={cx("input", error && "is-error")}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
      />
      <FieldHelp id={helpId} help={help} />
      <FieldError id={errorId} error={error} />
    </div>
  )
}

// Zone de texte avec compteur « n / max » quand maxLength est fourni.
export function TextareaField({ id, label, help, error, required, optional, maxLength, className, value, defaultValue, onChange, ...rest }) {
  const showHelp = Boolean(help || maxLength)
  const { inputId, helpId, errorId, describedBy } = useFieldIds(id, showHelp, error)
  const [inner, setInner] = useState(String(defaultValue ?? ""))
  const text = value !== undefined ? String(value) : inner
  return (
    <div className={cx("field", className)}>
      <FieldLabel htmlFor={inputId} label={label} required={required} optional={optional} />
      <textarea
        {...rest}
        id={inputId}
        className={cx("input", error && "is-error")}
        required={required}
        maxLength={maxLength}
        value={value !== undefined ? value : inner}
        onChange={(e) => {
          if (value === undefined) setInner(e.target.value)
          onChange?.(e)
        }}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
      />
      {showHelp ? (
        <FieldHelp id={helpId} help={help}>
          {maxLength ? <span className="field__count">{text.length.toLocaleString("fr-FR")} / {maxLength.toLocaleString("fr-FR")}</span> : null}
        </FieldHelp>
      ) : null}
      <FieldError id={errorId} error={error} />
    </div>
  )
}

// Montant en FCFA : entier, milliers séparés par une espace fine insécable.
// `value` / `onChange` : nombre ou null (contrôlé) ; `name` : un champ caché porte les chiffres bruts.
export function AmountField({ id, label, help, error, required, optional, name, value, defaultValue, onChange, className, ...rest }) {
  const { inputId, helpId, errorId, describedBy } = useFieldIds(id, help, error)
  const [inner, setInner] = useState(defaultValue ?? null)
  const amount = value !== undefined ? value : inner
  const display = amount === null || amount === undefined ? "" : formatAmountInput(amount)

  return (
    <div className={cx("field", className)}>
      <FieldLabel htmlFor={inputId} label={label} required={required} optional={optional} />
      <div className={cx("control", error && "is-error")}>
        <input
          {...rest}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          value={display}
          onChange={(e) => {
            const next = parseAmountInput(e.target.value)
            if (value === undefined) setInner(next)
            onChange?.(next)
          }}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
        />
        <span className="control__suffix">FCFA</span>
      </div>
      {name ? <input type="hidden" name={name} value={amount ?? ""} /> : null}
      <FieldHelp id={helpId} help={help} />
      <FieldError id={errorId} error={error} />
    </div>
  )
}

// Enveloppe de <Select> (variante champ) : le libellé désigne le déclencheur.
export function SelectField({ id, label, help, error, required, optional, className, options, ...selectProps }) {
  const { inputId, helpId, errorId, describedBy } = useFieldIds(id, help, error)
  return (
    <div className={cx("field", className)}>
      <FieldLabel htmlFor={inputId} label={label} required={required} optional={optional} />
      <Select
        {...selectProps}
        id={inputId}
        options={options}
        variant="field"
        invalid={Boolean(error)}
        required={required}
        aria-describedby={describedBy}
      />
      <FieldHelp id={helpId} help={help} />
      <FieldError id={errorId} error={error} />
    </div>
  )
}

export function CheckboxField({ id, label, help, error, className, ...inputProps }) {
  const { inputId, helpId, errorId, describedBy } = useFieldIds(id, help, error)
  return (
    <div className={cx("field", className)}>
      <label className={cx("check", error && "is-error")} htmlFor={inputId}>
        <input
          {...inputProps}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
        />
        <span>
          {label}
          {help ? <span id={helpId} className="check__sub">{help}</span> : null}
        </span>
      </label>
      <FieldError id={errorId} error={error} />
    </div>
  )
}
