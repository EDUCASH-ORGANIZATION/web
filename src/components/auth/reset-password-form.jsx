"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { updatePassword } from "@/lib/actions/password.actions"
import { PASSWORD_RULES, makeResetSchema, parseFormData } from "@/lib/auth/schemas"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { PasswordChecklist } from "@/components/auth/ui/password-checklist"
import { PasswordInput } from "@/components/auth/ui/password-input"

// Écran neutre : vouvoiement.
const AUDIENCE = "client"

/** Lien de récupération expiré, déjà utilisé ou absent : retour vers A05. */
export function ResetLinkExpired() {
  return (
    <div className="auth__form a-center">
      <div className="empty__art a-mx-auto">
        <span className="ic-sq ic-sq--alerte">
          <Icon name="i-clock" />
        </span>
      </div>
      <h1 className="ds-h1">Ce lien a expiré</h1>
      <p className="muted">Les liens de réinitialisation ne servent qu&apos;une fois et expirent. Demandez-en un nouveau.</p>
      <Link className="btn btn--primary btn--lg btn--block" href="/auth/forgot-password">
        Demander un nouveau lien
      </Link>
      <Link className="link body-s" href="/auth/login">
        Retour à la connexion
      </Link>
    </div>
  )
}

/**
 * Nouveau mot de passe (A06), affiché seulement avec une session de récupération (vérifiée par la page).
 * Action serveur `updatePassword`.
 * @param {{ email?: string }} props adresse du compte en cours de récupération (rappel, facultatif)
 */
export function ResetPasswordForm({ email = "" }) {
  const [state, formAction, pending] = useActionState(updatePassword, null)
  const [clientErrors, setClientErrors] = useState(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [seenState, setSeenState] = useState(state)

  // Après une erreur renvoyée par le serveur, les deux champs sont vidés (jamais de mot de passe conservé).
  if (state !== seenState) {
    setSeenState(state)
    if (state && state.status !== "updated") {
      setPassword("")
      setConfirm("")
    }
  }

  if (state?.status === "updated") {
    return (
      <div className="auth__form a-center">
        <div className="empty__art a-mx-auto">
          <span className="ic-sq ic-sq--menthe">
            <Icon name="i-check" />
          </span>
          <Icon name="sc-burst" className="scribble scribble--bleu a-burst" />
        </div>
        <h1 className="ds-h1">Mot de passe modifié</h1>
        <p className="muted">
          Vous pouvez vous connecter avec votre nouveau mot de passe. Vos autres appareils ont été déconnectés par
          sécurité.
        </p>
        <Link className="btn btn--primary btn--lg btn--block" href="/auth/login">
          <Icon name="i-login" />
          Me connecter
        </Link>
      </div>
    )
  }

  if (state?.code === "expired") return <ResetLinkExpired />

  const errors = clientErrors ?? state?.fieldErrors ?? {}
  const showRuleErrors = Boolean(errors.password)

  function handleSubmit(event) {
    const parsed = parseFormData(makeResetSchema(AUDIENCE), new FormData(event.currentTarget))
    if (parsed.ok) {
      setClientErrors(null)
      return
    }
    event.preventDefault()
    setClientErrors(parsed.fieldErrors)
  }

  return (
    <form className="auth__form" action={formAction} onSubmit={handleSubmit} noValidate>
      <div>
        <h1 className="ds-h1">Nouveau mot de passe</h1>
        <p className="muted a-lead">
          {email ? `Pour le compte ${email}.` : "Choisissez un mot de passe que vous n'utilisez nulle part ailleurs."}
        </p>
      </div>

      {state?.formError && !clientErrors && (
        <FormBanner tone="erreur">{state.formError}</FormBanner>
      )}

      <div className="field">
        <label className="field__label" htmlFor="reset-password">
          Nouveau mot de passe <span className="req">*</span>
        </label>
        <PasswordInput
          id="reset-password"
          name="password"
          audience={AUDIENCE}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "reset-password-error reset-password-rules" : "reset-password-rules"}
        />
        <FieldError id="reset-password-error" message={errors.password} />
        <PasswordChecklist id="reset-password-rules" rules={PASSWORD_RULES} value={password} showErrors={showRuleErrors} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="reset-confirm">
          Confirmez le mot de passe <span className="req">*</span>
        </label>
        <PasswordInput
          id="reset-confirm"
          name="confirmPassword"
          audience={AUDIENCE}
          autoComplete="new-password"
          placeholder="Le même"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? "reset-confirm-error" : undefined}
        />
        <FieldError id="reset-confirm-error" message={errors.confirmPassword} />
      </div>

      <HydratedSubmit pending={pending}>Enregistrer le mot de passe</HydratedSubmit>
    </form>
  )
}
