"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { resendSignupConfirmation } from "@/lib/actions/email-confirmation.actions"
import { loginHref, registerHref } from "@/lib/auth/destinations"
import { makeResendSchema, parseFormData } from "@/lib/auth/schemas"
import { CountdownButton } from "@/components/auth/ui/countdown-button"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { MailboxLink } from "@/components/auth/ui/mailbox-link"

// Textes par public : étudiant tutoyé, client vouvoyé. Aucune durée de validité affichée.
export const VERIFY_COPY = {
  student: {
    title: "Vérifie ta boîte mail",
    sentTo: "On a envoyé un lien de confirmation à",
    sentToUnknown: "On a envoyé un lien de confirmation à ton adresse email.",
    otherDevice: "Lien ouvert sur un autre appareil ?",
    otherDeviceAction: "Connecte-toi ici",
    otherDeviceEnd: "avec ton mot de passe.",
    noMail: "Rien reçu ? Regarde dans les spams et l'onglet Promotions.",
    emailLabel: "Ton adresse email",
    resent: "Email renvoyé.",
  },
  client: {
    title: "Vérifiez votre boîte mail",
    sentTo: "Nous avons envoyé un lien de confirmation à",
    sentToUnknown: "Nous avons envoyé un lien de confirmation à votre adresse email.",
    otherDevice: "Vous avez ouvert le lien sur un autre appareil ?",
    otherDeviceAction: "Connectez-vous ici",
    otherDeviceEnd: "avec votre mot de passe.",
    noMail: "Rien reçu ? Regardez dans les spams et l'onglet Promotions.",
    emailLabel: "Votre adresse email",
    resent: "Email renvoyé.",
  },
}

function Burst() {
  return (
    <svg className="scribble scribble--bleu a-burst" aria-hidden="true" focusable="false">
      <use href={`/sprite.svg?v=${SPRITE_VERSION}#sc-burst`} />
    </svg>
  )
}

function contextFields({ audience, role, next }) {
  return (
    <>
      <input type="hidden" name="audience" value={audience} />
      {role && <input type="hidden" name="role" value={role} />}
      {next && <input type="hidden" name="next" value={next} />}
    </>
  )
}

// Renvoi quand l'adresse est connue (cookie) : l'adresse ne transite jamais par le navigateur.
function ResendKnownAddress({ email, audience, role, next, copy }) {
  const [notice, setNotice] = useState(null)

  async function resend() {
    const formData = new FormData()
    formData.set("audience", audience)
    if (role) formData.set("role", role)
    if (next) formData.set("next", next)
    const result = await resendSignupConfirmation(null, formData)
    if (result?.status === "sent") {
      setNotice({ tone: "succes", text: `${copy.resent} ${email}` })
    } else {
      setNotice({ tone: "erreur", text: result?.formError ?? result?.fieldErrors?.email })
    }
  }

  return (
    <>
      {notice && (
        <FormBanner tone={notice.tone}>
          <span>{notice.text}</span>
        </FormBanner>
      )}
      <div className="stack stack--3 a-w-full">
        <MailboxLink email={email} />
        <CountdownButton
          label="Renvoyer l'email"
          className="btn btn--secondary btn--block"
          onClick={resend}
        />
      </div>
    </>
  )
}

// Sans cookie : l'adresse est saisie, l'envoi se fait par action serveur (POST).
function ResendWithField({ audience, role, next, copy }) {
  const [state, formAction, pending] = useActionState(resendSignupConfirmation, null)
  const [email, setEmail] = useState("")
  const [clientError, setClientError] = useState(null)
  const error = clientError ?? state?.fieldErrors?.email

  function handleSubmit(event) {
    const parsed = parseFormData(makeResendSchema(audience), new FormData(event.currentTarget))
    if (!parsed.ok) {
      event.preventDefault()
      setClientError(parsed.fieldErrors.email ?? null)
      return
    }
    setClientError(null)
  }

  return (
    <form className="stack stack--3 a-w-full a-block-left" action={formAction} onSubmit={handleSubmit} noValidate>
      {contextFields({ audience, role, next })}
      {state?.status === "sent" && !clientError && (
        <FormBanner tone="succes">
          <span>{copy.resent}</span>
        </FormBanner>
      )}
      {state?.formError && !clientError && <FormBanner tone="erreur">{state.formError}</FormBanner>}
      <div className="field">
        <label className="field__label" htmlFor="v-email">
          {copy.emailLabel} <span className="req">*</span>
        </label>
        <input
          className={`input${error ? " is-error" : ""}`}
          id="v-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "v-email-e" : undefined}
        />
        <FieldError id="v-email-e" message={error} />
      </div>
      <HydratedSubmit pending={pending} className="btn btn--secondary btn--block">
        Renvoyer l&apos;email
      </HydratedSubmit>
    </form>
  )
}

/**
 * Contenu de l'écran A03 (vérification de l'email). `email` vient du cookie httpOnly lu par la
 * page serveur : jamais de l'URL. Sans adresse, l'écran propose un champ pour renvoyer le lien.
 * @param {{ email?: string | null, audience?: "student" | "client", role?: "student" | "client" | null, next?: string | null }} props
 */
export function VerifyEmailPanel({ email = null, audience = "client", role = null, next = null }) {
  const copy = VERIFY_COPY[audience === "student" ? "student" : "client"]
  const known = Boolean(email)

  return (
    <div className="auth__form a-center">
      <div className="empty__art a-mx-auto">
        <span className="ic-sq ic-sq--bleu">
          <Icon name="i-mail" />
        </span>
        <Burst />
      </div>
      <h1 className="ds-h1">{copy.title}</h1>
      <p className="muted">
        {known ? (
          <>
            {copy.sentTo} <b className="a-strong">{email}</b>.
          </>
        ) : (
          copy.sentToUnknown
        )}
      </p>

      {known ? (
        <ResendKnownAddress email={email} audience={audience} role={role} next={next} copy={copy} />
      ) : (
        <ResendWithField audience={audience} role={role} next={next} copy={copy} />
      )}

      <Link className="link body-s" href={registerHref({ role, next })}>
        Modifier l&apos;adresse
      </Link>

      <div className="divider a-w-full" />

      <div className="card card--sm card--soft a-block-left">
        <div className="row row--nowrap row--top">
          <span className="ic-sq ic-sq--sm ic-sq--lavande">
            <Icon name="i-smartphone" />
          </span>
          <div className="body-s">
            <b>{copy.otherDevice}</b>{" "}
            <Link className="link" href={loginHref({ next })}>
              {copy.otherDeviceAction}
            </Link>{" "}
            {copy.otherDeviceEnd}
          </div>
        </div>
      </div>

      <p className="caption">{copy.noMail}</p>
    </div>
  )
}
