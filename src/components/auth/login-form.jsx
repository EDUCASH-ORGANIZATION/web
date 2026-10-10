"use client"

import { useActionState, useRef, useState } from "react"
import Link from "next/link"
import { login } from "@/lib/actions/auth.actions"
import { resendSignupConfirmation } from "@/lib/actions/email-confirmation.actions"
import { makeLoginSchema, parseFormData } from "@/lib/auth/schemas"
import { registerHref } from "@/lib/auth/destinations"
import { CountdownButton } from "@/components/auth/ui/countdown-button"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { PasswordInput } from "@/components/auth/ui/password-input"

const COPY = {
  student: {
    title: "Content de te revoir",
    lead: "Connecte-toi pour retrouver tes missions et ton portefeuille.",
    next: "Connecte-toi pour continuer. Tu reviens juste après sur la page demandée.",
    emailPlaceholder: "toi@exemple.bj",
    passwordPlaceholder: "Ton mot de passe",
    resent: "Email renvoyé. Regarde ta boîte de réception et tes spams.",
  },
  client: {
    title: "Content de vous revoir",
    lead: "Connectez-vous pour retrouver vos missions et votre portefeuille.",
    next: "Connectez-vous pour continuer. Vous reviendrez juste après sur la page demandée.",
    emailPlaceholder: "vous@exemple.bj",
    passwordPlaceholder: "Votre mot de passe",
    resent: "Email renvoyé. Regardez votre boîte de réception et vos spams.",
  },
}

// Bannière selon le code renvoyé par l'action (le message est déjà adapté à l'audience).
const BANNERS = {
  email_not_confirmed: { tone: "alerte", icon: "i-mail" },
  rate_limited: { tone: "alerte", icon: "i-clock", title: "Trop de tentatives" },
  session_expired: { tone: "info", icon: "i-clock" },
  network: { tone: "alerte", icon: "i-wifi-off" },
  suspended: { tone: "erreur", title: "Compte suspendu" },
}

/**
 * Formulaire de connexion (A01). Action serveur `login` : POST garanti, fonctionne sans JavaScript.
 * @param {{
 *   role?: "student" | "client" | null,
 *   next?: string | null,
 *   forgotHref?: string,
 * }} props `role` : public connu (student tutoyé, client vouvoyé) ; sans lui, vouvoiement neutre.
 * `student` ajoute le champ caché `audience=student`. `next` est un chemin déjà validé.
 */
export function LoginForm({ role = null, next = null, forgotHref = "/auth/forgot-password" }) {
  const audience = role === "student" ? "student" : "client"
  const copy = COPY[audience]
  const [state, formAction, pending] = useActionState(login, null)
  const [clientErrors, setClientErrors] = useState(null)
  const [email, setEmail] = useState("")
  const [resent, setResent] = useState(false)
  const formRef = useRef(null)

  const errors = clientErrors ?? state?.fieldErrors ?? {}
  const banner = state?.formError && !clientErrors ? BANNERS[state.code] ?? { tone: "erreur" } : null

  function handleSubmit(event) {
    const parsed = parseFormData(makeLoginSchema(audience), new FormData(event.currentTarget))
    if (parsed.ok) {
      setClientErrors(null)
      setResent(false)
      return
    }
    event.preventDefault()
    setClientErrors(parsed.fieldErrors)
  }

  async function resend() {
    const data = new FormData()
    data.set("email", formRef.current?.elements.email?.value ?? "")
    data.set("audience", audience)
    if (next) data.set("next", next)
    const result = await resendSignupConfirmation(null, data)
    setResent(!result?.formError && !result?.fieldErrors)
  }

  return (
    <form ref={formRef} className="auth__form" action={formAction} onSubmit={handleSubmit} noValidate>
      {next && (
        <FormBanner tone="info" icon="i-arrow-right">
          {copy.next}
        </FormBanner>
      )}
      <div>
        <h1 className="ds-h1">{copy.title}</h1>
        <p className="muted a-lead">{copy.lead}</p>
      </div>

      {banner && (
        <FormBanner
          tone={banner.tone}
          icon={banner.icon}
          title={banner.title}
          actions={
            state.code === "email_not_confirmed" ? (
              resent ? null : (
                <CountdownButton label="Renvoyer l'email de confirmation" onClick={resend} />
              )
            ) : state.code === "suspended" && state.contactHref ? (
              <Link className="link body-s" href={state.contactHref}>
                Nous contacter
              </Link>
            ) : null
          }
        >
          {state.formError}
        </FormBanner>
      )}
      {resent && <FormBanner tone="succes">{copy.resent}</FormBanner>}

      <div className="field">
        <label className="field__label" htmlFor="login-email">
          Adresse email <span className="req">*</span>
        </label>
        <input
          className={`input${errors.email ? " is-error" : ""}`}
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={copy.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "login-email-error" : undefined}
        />
        <FieldError id="login-email-error" message={errors.email} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="login-password">
          Mot de passe <span className="req">*</span>
        </label>
        <PasswordInput
          id="login-password"
          name="password"
          audience={audience}
          autoComplete="current-password"
          placeholder={copy.passwordPlaceholder}
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "login-password-error" : undefined}
        />
        <FieldError id="login-password-error" message={errors.password} />
        <Link className="link body-s a-self-end" href={forgotHref}>
          Mot de passe oublié ?
        </Link>
      </div>

      {next && <input type="hidden" name="next" value={next} />}
      {role === "student" && <input type="hidden" name="audience" value="student" />}

      <HydratedSubmit pending={pending}>Se connecter</HydratedSubmit>

      <p className="body-s a-ta-center">
        Pas encore de compte ?{" "}
        <Link className="link" href={registerHref({ role: role ?? undefined, next })}>
          Créer un compte
        </Link>
      </p>
    </form>
  )
}
