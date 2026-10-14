"use client"

import { useActionState, useState } from "react"
import { Icon } from "@/components/design/icon"
import { requestPasswordReset } from "@/lib/actions/password.actions"
import { makeForgotSchema, parseFormData } from "@/lib/auth/schemas"
import { CountdownButton } from "@/components/auth/ui/countdown-button"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { MailboxLink } from "@/components/auth/ui/mailbox-link"

const COPY = {
  lead: "Saisissez l'adresse de votre compte. Nous vous envoyons un lien pour en choisir un nouveau.",
  placeholder: "vous@exemple.bj",
  sentTitle: "Regardez votre boîte mail",
  sentLead: "Si un compte existe pour",
  sentEnd: ", vous allez recevoir un lien pour choisir un nouveau mot de passe.",
  hint: "Rien reçu ? Regardez dans les spams, ou vérifiez l'adresse indiquée.",
}

const BANNERS = {
  rate_limited: { tone: "alerte", icon: "i-clock", title: "Trop de demandes" },
  network: { tone: "alerte", icon: "i-wifi-off" },
}

/**
 * Mot de passe oublié (A05). Action serveur `requestPasswordReset` : même réponse que le compte
 * existe ou non. L'adresse est gardée en état client (jamais dans l'URL).
 */
export function ForgotPasswordForm() {
  const copy = COPY
  const [state, formAction, pending] = useActionState(requestPasswordReset, null)
  const [clientErrors, setClientErrors] = useState(null)
  const [email, setEmail] = useState("")
  const [resendError, setResendError] = useState("")

  const errors = clientErrors ?? state?.fieldErrors ?? {}
  const banner = state?.formError && !clientErrors ? BANNERS[state.code] ?? { tone: "erreur" } : null

  function handleSubmit(event) {
    const parsed = parseFormData(makeForgotSchema(), new FormData(event.currentTarget))
    if (parsed.ok) {
      setClientErrors(null)
      return
    }
    event.preventDefault()
    setClientErrors(parsed.fieldErrors)
  }

  async function resend() {
    const data = new FormData()
    data.set("email", email)
    const result = await requestPasswordReset(null, data)
    setResendError(result?.formError ?? "")
  }

  if (state?.status === "sent") {
    return (
      <div className="auth__form a-center">
        <div className="empty__art a-mx-auto">
          <span className="ic-sq ic-sq--menthe">
            <Icon name="i-mail" />
          </span>
          <Icon name="sc-burst" className="scribble scribble--bleu a-burst" />
        </div>
        <h1 className="ds-h1">{copy.sentTitle}</h1>
        <p className="muted">
          {copy.sentLead} <b className="a-strong">{email.trim()}</b>
          {copy.sentEnd}
        </p>
        <MailboxLink email={email} />
        {resendError && <FormBanner tone="alerte">{resendError}</FormBanner>}
        <CountdownButton autoStart label="Renvoyer l'email" className="btn btn--secondary btn--block" onClick={resend} />
        <p className="caption">{copy.hint}</p>
      </div>
    )
  }

  return (
    <form className="auth__form" action={formAction} onSubmit={handleSubmit} noValidate>
      <div>
        <h1 className="ds-h1">Mot de passe oublié ?</h1>
        <p className="muted a-lead">{copy.lead}</p>
      </div>

      {banner && (
        <FormBanner tone={banner.tone} icon={banner.icon} title={banner.title}>
          {state.formError}
        </FormBanner>
      )}

      <div className="field">
        <label className="field__label" htmlFor="forgot-email">
          Adresse email <span className="req">*</span>
        </label>
        <input
          className={`input${errors.email ? " is-error" : ""}`}
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={copy.placeholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "forgot-email-error" : undefined}
        />
        <FieldError id="forgot-email-error" message={errors.email} />
      </div>

      <HydratedSubmit pending={pending}>Recevoir le lien</HydratedSubmit>
    </form>
  )
}
