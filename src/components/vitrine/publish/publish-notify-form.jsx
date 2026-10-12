"use client"

import { useActionState, useState } from "react"
import { Icon } from "@/components/design/icon"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { notifyPublishOpening } from "@/lib/actions/publish-waitlist.actions"
import { HONEYPOT_FIELD, parseWaitlistForm } from "@/lib/publish-waitlist/schema"

const APP_STYLES = {
  form: "flex flex-col gap-3 w-full text-left",
  label: "text-sm font-semibold text-gray-700",
  input:
    "w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--c-bleu)]/30",
  error: "text-xs text-red-600 font-semibold",
  banner: "text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3",
  button:
    "w-full h-11 rounded-xl bg-[var(--c-bleu)] text-white text-sm font-bold hover:bg-[var(--c-bleu-700)] transition-colors disabled:opacity-60 touch-manipulation",
  sent: "w-full flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-left text-sm text-green-800",
}

/**
 * Formulaire « Prévenez-moi » (email seul). Action serveur, honeypot, bouton inactif avant hydratation.
 * `variant="ds"` : classes du système (vitrine, sous une racine .ds) ; `variant="app"` : Tailwind des
 * espaces connectés. Le ton est toujours le vouvoiement (public client).
 * @param {{ variant?: "ds" | "app", idPrefix?: string }} props
 */
export function PublishNotifyForm({ variant = "ds", idPrefix = "notify" }) {
  const [state, formAction, pending] = useActionState(notifyPublishOpening, null)
  const [clientErrors, setClientErrors] = useState(null)
  const [email, setEmail] = useState("")
  const app = variant === "app"

  const errors = clientErrors ?? state?.fieldErrors ?? {}
  const inputId = `${idPrefix}-email`

  function handleSubmit(event) {
    const parsed = parseWaitlistForm(new FormData(event.currentTarget))
    if (parsed.ok || parsed.spam) {
      setClientErrors(null)
      return
    }
    event.preventDefault()
    setClientErrors(parsed.fieldErrors)
  }

  if (state?.status === "sent") {
    const sent = (
      <>
        Merci, c&apos;est noté. Nous vous écrivons à <b>{email.trim()}</b> dès que la publication ouvre.
      </>
    )
    if (app) return <div className={APP_STYLES.sent} role="status">{sent}</div>
    return (
      <FormBanner tone="succes" title="C'est noté">
        {sent}
      </FormBanner>
    )
  }

  const serverBanner = state?.formError && !clientErrors ? state.formError : null

  return (
    <form className={app ? APP_STYLES.form : "auth__form"} action={formAction} onSubmit={handleSubmit} noValidate>
      {serverBanner ? (
        app ? (
          <p className={APP_STYLES.banner} role="alert">{serverBanner}</p>
        ) : (
          <FormBanner tone="alerte" icon={state.code === "rate_limited" ? "i-clock" : undefined}>
            {serverBanner}
          </FormBanner>
        )
      ) : null}

      <div className={app ? "flex flex-col gap-1.5" : "field"}>
        <label className={app ? APP_STYLES.label : "field__label"} htmlFor={inputId}>
          Prévenez-moi à l&apos;ouverture
        </label>
        <input
          className={app ? APP_STYLES.input : `input${errors.email ? " is-error" : ""}`}
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="vous@exemple.bj"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${inputId}-error` : undefined}
        />
        {app ? (
          errors.email ? <span className={APP_STYLES.error} id={`${inputId}-error`} role="alert">{errors.email}</span> : null
        ) : (
          <FieldError id={`${inputId}-error`} message={errors.email} />
        )}
      </div>

      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`${idPrefix}-website`}>Laissez ce champ vide</label>
        <input id={`${idPrefix}-website`} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {app ? (
        <HydratedSubmit pending={pending} className={APP_STYLES.button}>Prévenez-moi</HydratedSubmit>
      ) : (
        <HydratedSubmit pending={pending}>
          Prévenez-moi
          <Icon name="i-bell" />
        </HydratedSubmit>
      )}
    </form>
  )
}
