"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { requestPasswordReset } from "@/lib/actions/password.actions"
import { makeForgotSchema, parseFormData } from "@/lib/auth/schemas"
import { CountdownButton } from "@/components/auth/ui/countdown-button"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { MailboxLink } from "@/components/auth/ui/mailbox-link"

const COPY = {
  student: {
    lead: "Saisis l'adresse de ton compte. Nous t'envoyons un lien pour en choisir un nouveau.",
    placeholder: "toi@exemple.bj",
    sentTitle: "Regarde ta boîte mail",
    sentLead: "Si un compte existe pour",
    sentEnd: ", tu vas recevoir un lien pour choisir un nouveau mot de passe.",
    hint: "Rien reçu ? Regarde dans les spams, ou vérifie l'adresse indiquée.",
  },
  client: {
    lead: "Saisissez l'adresse de votre compte. Nous vous envoyons un lien pour en choisir un nouveau.",
    placeholder: "vous@exemple.bj",
    sentTitle: "Regardez votre boîte mail",
    sentLead: "Si un compte existe pour",
    sentEnd: ", vous allez recevoir un lien pour choisir un nouveau mot de passe.",
    hint: "Rien reçu ? Regardez dans les spams, ou vérifiez l'adresse indiquée.",
  },
}

const BANNERS = {
  rate_limited: { tone: "alerte", icon: "i-clock", title: "Trop de demandes" },
  network: { tone: "alerte", icon: "i-wifi-off" },
}

/**
 * Mot de passe oublié (A05). Action serveur `requestPasswordReset` : même réponse que le compte
 * existe ou non. L'adresse est gardée en état client (jamais dans l'URL).
 * @param {{ role?: "student" | "client" | null, loginHref?: string }} props
 */
export function ForgotPasswordForm({ role = null, loginHref = "/auth/login" }) {
  const audience = role === "student" ? "student" : "client"
  const copy = COPY[audience]
  const [state, formAction, pending] = useActionState(requestPasswordReset, null)
  const [clientErrors, setClientErrors] = useState(null)
  const [email, setEmail] = useState("")
  const [resendError, setResendError] = useState("")

  const errors = clientErrors ?? state?.fieldErrors ?? {}
  const banner = state?.formError && !clientErrors ? BANNERS[state.code] ?? { tone: "erreur" } : null

  function handleSubmit(event) {
    const parsed = parseFormData(makeForgotSchema(audience), new FormData(event.currentTarget))
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
    data.set("audience", audience)
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
        <Link className="link body-s" href={loginHref}>
          Retour à la connexion
        </Link>
        <p className="caption">{copy.hint}</p>
      </div>
    )
  }

  return (
    <form className="auth__form" action={formAction} onSubmit={handleSubmit} noValidate>
      <Link className="auth__back" href={loginHref}>
        <Icon name="i-arrow-left" className="ic ic--20" />
        Retour à la connexion
      </Link>
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

      {role === "student" && <input type="hidden" name="audience" value="student" />}

      <HydratedSubmit pending={pending}>Recevoir le lien</HydratedSubmit>
    </form>
  )
}
