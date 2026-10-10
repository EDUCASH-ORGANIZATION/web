"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { register } from "@/lib/actions/auth.actions"
import { loginHref, registerHref } from "@/lib/auth/destinations"
import { PASSWORD_RULES, makeRegisterSchema, parseFormData } from "@/lib/auth/schemas"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { PasswordInput } from "@/components/auth/ui/password-input"
import { PasswordChecklist } from "@/components/auth/ui/password-checklist"
import { ChoiceCard } from "@/components/auth/ui/choice-card"

// Textes par public : étudiant tutoyé, client vouvoyé.
export const REGISTER_COPY = {
  student: {
    title: "Crée ton compte",
    lead: "Gratuit, en moins d'une minute.",
    emailPlaceholder: "toi@exemple.bj",
    confirmLabel: "Confirme ton mot de passe",
  },
  client: {
    title: "Créez votre compte",
    lead: "Gratuit. Vous publiez votre première mission juste après.",
    emailPlaceholder: "vous@exemple.bj",
    confirmLabel: "Confirmez le mot de passe",
  },
}

const ROLE_CARDS = [
  { role: "student", icon: "i-graduation", tone: "bleu", title: "Je suis étudiant", sub: "Je cherche des missions payées" },
  { role: "client", icon: "i-briefcase", tone: "", title: "Je publie des missions", sub: "Particulier, PME ou association" },
]

/**
 * Formulaire d'inscription (A02). Envoi par action serveur (POST), jamais en GET :
 * le bouton reste inactif tant que la page n'est pas hydratée.
 * Le rôle vient de `?role=` (cartes-liens, fonctionnent sans JavaScript) ; `audience` règle le ton.
 * @param {{ role?: "student" | "client" | null, audience?: "student" | "client", next?: string | null }} props
 */
export function RegisterForm({ role: roleProp = null, audience: audienceProp = "student", next = null }) {
  const [state, formAction, pending] = useActionState(register, null)
  const [picked, setPicked] = useState(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [cgu, setCgu] = useState(false)
  const [clientErrors, setClientErrors] = useState(null)

  const role = picked ?? roleProp
  const audience = picked ?? audienceProp
  const copy = REGISTER_COPY[audience === "client" ? "client" : "student"]
  const errors = clientErrors ?? state?.fieldErrors ?? {}
  const emailTaken = !clientErrors && state?.code === "email_taken"
  const formError = !clientErrors && state?.formError

  function handleSubmit(event) {
    const parsed = parseFormData(makeRegisterSchema(audience), new FormData(event.currentTarget))
    if (!parsed.ok) {
      event.preventDefault()
      setClientErrors(parsed.fieldErrors)
      return
    }
    setClientErrors(null)
  }

  return (
    <form className="auth__form" action={formAction} onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="audience" value={audience} />
      <input type="hidden" name="role" value={role ?? ""} />
      {next && <input type="hidden" name="next" value={next} />}

      <div>
        <h1 className="ds-h1">{copy.title}</h1>
        <p className="muted a-lead">{copy.lead}</p>
      </div>

      {formError && !emailTaken && <FormBanner tone="erreur">{formError}</FormBanner>}

      <div className="field" role="radiogroup" aria-label="Type de compte" aria-describedby={errors.role ? "r-role-e" : undefined}>
        <span className="field__label">
          Je m&apos;inscris en tant que <span className="req">*</span>
        </span>
        <div className="stack stack--2">
          {ROLE_CARDS.map((card) => (
            <ChoiceCard
              key={card.role}
              title={card.title}
              sub={card.sub}
              icon={card.icon}
              tone={card.tone}
              selected={role === card.role}
              invalid={Boolean(errors.role)}
              href={registerHref({ role: card.role, next })}
              onSelect={() => setPicked(card.role)}
            />
          ))}
        </div>
        <FieldError id="r-role-e" message={errors.role} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="r-email">
          Adresse email <span className="req">*</span>
        </label>
        <input
          className={`input${errors.email ? " is-error" : ""}`}
          id="r-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={copy.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email) || undefined}
          aria-describedby={errors.email ? "r-email-e" : undefined}
        />
        <FieldError id="r-email-e" message={errors.email} />
        {emailTaken && (
          <p className="body-s">
            <Link className="link" href={loginHref({ next })}>
              Se connecter
            </Link>{" "}
            ou{" "}
            <Link className="link" href="/auth/forgot-password">
              Mot de passe oublié ?
            </Link>
          </p>
        )}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="r-pwd">
          Mot de passe <span className="req">*</span>
        </label>
        <PasswordInput
          id="r-pwd"
          name="password"
          audience={audience}
          autoComplete="new-password"
          placeholder="8 caractères min."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "r-pwd-e r-pwd-rules" : "r-pwd-rules"}
        />
        <FieldError id="r-pwd-e" message={errors.password} />
        <PasswordChecklist id="r-pwd-rules" rules={PASSWORD_RULES} value={password} showErrors={Boolean(errors.password)} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="r-conf">
          {copy.confirmLabel} <span className="req">*</span>
        </label>
        <PasswordInput
          id="r-conf"
          name="confirmPassword"
          audience={audience}
          autoComplete="new-password"
          placeholder="Le même"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? "r-conf-e" : undefined}
        />
        <FieldError id="r-conf-e" message={errors.confirmPassword} />
      </div>

      <div className="field">
        <label className={`check${errors.cgu ? " is-error" : ""}`}>
          <input
            type="checkbox"
            name="cgu"
            checked={cgu}
            onChange={(event) => setCgu(event.target.checked)}
            aria-invalid={Boolean(errors.cgu) || undefined}
            aria-describedby={errors.cgu ? "r-cgu-e" : undefined}
          />
          <span>
            J&apos;accepte les{" "}
            <Link className="link" href="/legal/terms" target="_blank">
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link className="link" href="/legal/privacy" target="_blank">
              politique de confidentialité
            </Link>
          </span>
        </label>
        <FieldError id="r-cgu-e" message={errors.cgu} />
      </div>

      <HydratedSubmit pending={pending}>Créer mon compte</HydratedSubmit>

      <p className="body-s a-ta-center">
        Déjà inscrit ?{" "}
        <Link className="link" href={loginHref({ next })}>
          Se connecter
        </Link>
      </p>
    </form>
  )
}
