"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { resendSignupConfirmation } from "@/lib/actions/email-confirmation.actions"
import { loginHref } from "@/lib/auth/destinations"
import { makeResendSchema, parseFormData } from "@/lib/auth/schemas"
import { CountdownButton } from "@/components/auth/ui/countdown-button"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { MailboxLink } from "@/components/auth/ui/mailbox-link"

export const LINK_CAUSES = ["expire", "utilise", "autre-appareil", "invalide"]

// Une explication par cause. Étudiant tutoyé, client vouvoyé. Aucune durée de validité affichée.
export const LINK_EXPIRED_COPY = {
  student: {
    expire: {
      icon: "i-clock",
      tone: "alerte",
      title: "Ce lien a expiré",
      text: "Demande un nouveau lien pour confirmer ton adresse.",
      recoveryText: "Demande un nouveau lien pour choisir un nouveau mot de passe.",
    },
    utilise: {
      icon: "i-check-circle",
      tone: "bleu",
      title: "Ce lien a déjà servi",
      text: "Ton adresse est sans doute déjà confirmée. Connecte-toi pour continuer. Si ce n'est pas le cas, on t'enverra un nouveau lien.",
      recoveryText: "Pour des raisons de sécurité, un lien ne sert qu'une fois. Demande un nouveau lien pour changer ton mot de passe.",
    },
    "autre-appareil": {
      icon: "i-smartphone",
      tone: "lavande",
      title: "Lien ouvert sur un autre appareil",
      text: "Par sécurité, le lien doit s'ouvrir sur l'appareil où tu t'es inscrit. Le plus simple : connecte-toi ici, on finira la confirmation.",
      recoveryText: "Par sécurité, le lien doit s'ouvrir sur l'appareil où tu l'as demandé. Demande un nouveau lien pour changer ton mot de passe depuis cet appareil.",
    },
    invalide: {
      icon: "i-alert-triangle",
      tone: "alerte",
      title: "Ce lien n'est pas valide",
      text: "Il est peut-être incomplet. Demande un nouveau lien pour continuer.",
      recoveryText: "Il est peut-être incomplet. Demande un nouveau lien pour changer ton mot de passe.",
    },
    emailLabel: "Ton adresse email",
    submit: "Recevoir un nouveau lien",
    confirmedQuestion: "Ton adresse est déjà confirmée ?",
    notConfirmedQuestion: "Pas encore confirmé ?",
    login: "Me connecter",
    sentTitle: "Nouveau lien envoyé",
    sentText: "Regarde ta boîte",
    sentHint: "Ouvre le lien sur cet appareil-ci.",
  },
  client: {
    expire: {
      icon: "i-clock",
      tone: "alerte",
      title: "Ce lien a expiré",
      text: "Demandez un nouveau lien pour confirmer votre adresse.",
      recoveryText: "Demandez un nouveau lien pour choisir un nouveau mot de passe.",
    },
    utilise: {
      icon: "i-check-circle",
      tone: "bleu",
      title: "Ce lien a déjà servi",
      text: "Votre adresse est sans doute déjà confirmée. Connectez-vous pour continuer. Si ce n'est pas le cas, nous vous enverrons un nouveau lien.",
      recoveryText: "Pour des raisons de sécurité, un lien ne sert qu'une fois. Demandez un nouveau lien pour changer votre mot de passe.",
    },
    "autre-appareil": {
      icon: "i-smartphone",
      tone: "lavande",
      title: "Lien ouvert sur un autre appareil",
      text: "Par sécurité, le lien doit s'ouvrir sur l'appareil où vous vous êtes inscrit. Le plus simple : connectez-vous ici, nous finirons la confirmation.",
      recoveryText: "Par sécurité, le lien doit s'ouvrir sur l'appareil où vous l'avez demandé. Demandez un nouveau lien pour changer votre mot de passe depuis cet appareil.",
    },
    invalide: {
      icon: "i-alert-triangle",
      tone: "alerte",
      title: "Ce lien n'est pas valide",
      text: "Il est peut-être incomplet. Demandez un nouveau lien pour continuer.",
      recoveryText: "Il est peut-être incomplet. Demandez un nouveau lien pour changer votre mot de passe.",
    },
    emailLabel: "Votre adresse email",
    submit: "Recevoir un nouveau lien",
    confirmedQuestion: "Votre adresse est déjà confirmée ?",
    notConfirmedQuestion: "Pas encore confirmé ?",
    login: "Me connecter",
    sentTitle: "Nouveau lien envoyé",
    sentText: "Regardez votre boîte",
    sentHint: "Ouvrez le lien sur cet appareil-ci.",
  },
}

function Hidden({ audience, role, next }) {
  return (
    <>
      <input type="hidden" name="audience" value={audience} />
      {role && <input type="hidden" name="role" value={role} />}
      {next && <input type="hidden" name="next" value={next} />}
    </>
  )
}

/**
 * Écran A04 : lien d'authentification invalide ou expiré. `cause` : expire | utilise | autre-appareil | invalide ;
 * `flow="recovery"` oriente vers « Mot de passe oublié » (A05). Pour la confirmation d'inscription,
 * l'envoi d'un nouveau lien passe par une action serveur (POST), l'adresse n'est jamais dans l'URL.
 * @param {{
 *   cause?: string,
 *   flow?: "signup" | "recovery",
 *   audience?: "student" | "client",
 *   role?: "student" | "client" | null,
 *   next?: string | null,
 * }} props
 */
export function LinkExpiredForm({ cause = "invalide", flow = "signup", audience = "client", role = null, next = null }) {
  const [state, formAction, pending] = useActionState(resendSignupConfirmation, null)
  const [email, setEmail] = useState("")
  const [clientError, setClientError] = useState(null)

  const copy = LINK_EXPIRED_COPY[audience === "student" ? "student" : "client"]
  const causeKey = LINK_CAUSES.includes(cause) ? cause : "invalide"
  const entry = copy[causeKey]
  const recovery = flow === "recovery"
  const loginFirst = !recovery && (causeKey === "utilise" || causeKey === "autre-appareil")
  const error = clientError ?? state?.fieldErrors?.email
  const sent = state?.status === "sent" && !clientError

  function handleSubmit(event) {
    const parsed = parseFormData(makeResendSchema(audience), new FormData(event.currentTarget))
    if (!parsed.ok) {
      event.preventDefault()
      setClientError(parsed.fieldErrors.email ?? null)
      return
    }
    setClientError(null)
  }

  async function resendAgain() {
    const formData = new FormData()
    formData.set("email", email)
    formData.set("audience", audience)
    if (role) formData.set("role", role)
    if (next) formData.set("next", next)
    await resendSignupConfirmation(null, formData)
  }

  const loginLink = (primary) => (
    <Link className={`btn ${primary ? "btn--primary" : "btn--secondary"} btn--lg btn--block`} href={loginHref({ next })}>
      <Icon name="i-arrow-right" />
      {copy.login}
    </Link>
  )

  if (sent) {
    return (
      <div className="auth__form a-center">
        <div className="empty__art a-mx-auto">
          <span className="ic-sq ic-sq--bleu">
            <Icon name="i-mail" />
          </span>
        </div>
        <h1 className="ds-h1">{copy.sentTitle}</h1>
        <p className="muted">
          {copy.sentText} <b className="a-strong">{email.trim()}</b>. {copy.sentHint}
        </p>
        <div className="stack stack--3 a-w-full">
          <MailboxLink email={email} />
          <CountdownButton label="Renvoyer le lien" className="btn btn--secondary btn--block" autoStart onClick={resendAgain} />
        </div>
        <Link className="link body-s" href={loginHref({ next })}>
          Retour à la connexion
        </Link>
      </div>
    )
  }

  if (recovery) {
    return (
      <div className="auth__form a-center">
        <div className="empty__art a-mx-auto">
          <span className={`ic-sq ic-sq--${entry.tone}`}>
            <Icon name={entry.icon} />
          </span>
        </div>
        <h1 className="ds-h1">{entry.title}</h1>
        <p className="muted">{entry.recoveryText}</p>
        <Link className="btn btn--primary btn--lg btn--block" href="/auth/forgot-password">
          {copy.submit}
        </Link>
        <div className="divider a-w-full" />
        {loginLink(false)}
      </div>
    )
  }

  const resendForm = (
    <form className="stack a-w-full a-block-left" action={formAction} onSubmit={handleSubmit} noValidate>
      <Hidden audience={audience} role={role} next={next} />
      {state?.formError && !clientError && <FormBanner tone="erreur">{state.formError}</FormBanner>}
      <div className="field">
        <label className="field__label" htmlFor="x-e">
          {copy.emailLabel} <span className="req">*</span>
        </label>
        <input
          className={`input${error ? " is-error" : ""}`}
          id="x-e"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={audience === "student" ? "toi@exemple.bj" : "vous@exemple.bj"}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "x-e-e" : undefined}
        />
        <FieldError id="x-e-e" message={error} />
      </div>
      <HydratedSubmit pending={pending}>{copy.submit}</HydratedSubmit>
    </form>
  )

  return (
    <div className="auth__form a-center">
      <div className="empty__art a-mx-auto">
        <span className={`ic-sq ic-sq--${entry.tone}`}>
          <Icon name={entry.icon} />
        </span>
      </div>
      <h1 className="ds-h1">{entry.title}</h1>
      <p className="muted">{entry.text}</p>
      {loginFirst ? (
        <>
          {loginLink(true)}
          <div className="divider a-w-full" />
          <p className="body-s muted">{copy.notConfirmedQuestion}</p>
          {resendForm}
        </>
      ) : (
        <>
          {resendForm}
          <div className="divider a-w-full" />
          <p className="body-s muted">{copy.confirmedQuestion}</p>
          {loginLink(false)}
        </>
      )}
    </div>
  )
}
