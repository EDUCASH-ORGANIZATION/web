"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Icon } from "@/components/design/icon"
import { sendContactMessage } from "@/lib/actions/contact.actions"
import { CONTACT_LIMITS, CONTACT_SUBJECTS, HONEYPOT_FIELD, contactSchema } from "@/lib/contact/schema"
import { formatCount, submitContact } from "./submit"

const FIELD_NAMES = ["name", "email", "subject", "message"]

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <span className="field__error" id={id}>
      <Icon name="i-alert-circle" />
      {message}
    </span>
  )
}

export function ContactForm({ defaultSubject = "" }) {
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", subject: defaultSubject, message: "", [HONEYPOT_FIELD]: "" },
  })
  const [serverError, setServerError] = useState("")
  const [sent, setSent] = useState(null)

  const subject = useWatch({ control, name: "subject" })
  const messageLength = (useWatch({ control, name: "message" }) ?? "").length
  const errorCount = FIELD_NAMES.filter((n) => errors[n]).length

  async function onSubmit() {
    if (isSubmitting) return
    setServerError("")
    const values = getValues()
    const formData = new FormData()
    for (const key of [...FIELD_NAMES, HONEYPOT_FIELD]) formData.set(key, values[key] ?? "")

    const result = await submitContact(formData, sendContactMessage)

    if (result.status === "success") {
      const label = CONTACT_SUBJECTS.find((s) => s.id === values.subject)?.label ?? ""
      setSent({ name: values.name.trim(), email: values.email.trim(), subjectLabel: label })
      return
    }
    if (result.status === "invalid") {
      let first = true
      for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
        if (!FIELD_NAMES.includes(key)) continue
        setError(key, { type: "server", message }, { shouldFocus: first })
        first = false
      }
      if (first) setServerError("Le message n'a pas pu être envoyé. Vérifie les champs et réessaie.")
      return
    }
    setServerError(result.message)
  }

  function writeAnother() {
    reset({ name: "", email: "", subject: "", message: "", [HONEYPOT_FIELD]: "" })
    setSent(null)
  }

  if (sent) {
    return (
      <div className="v08-form" role="status">
        <div className="v08-sent">
          <span className="sticker">
            <Icon name="i-check" />
          </span>
          <h2 className="display display--m">Message envoyé.</h2>
          <p className="body-l">
            Merci {sent.name}. Ton message est bien arrivé&nbsp;: on te répond sous <b>24&nbsp;h ouvrées</b> à{" "}
            <b>{sent.email}</b>.
          </p>
          <div className="recap">
            <div className="recap__line">
              <span>Sujet</span>
              <b>{sent.subjectLabel}</b>
            </div>
          </div>
          <div className="row">
            <Link className="btn btn--primary" href="/">
              Retour à l&apos;accueil
            </Link>
            <button type="button" className="btn btn--secondary" onClick={writeAnother}>
              Écrire un autre message
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form className="v08-form" onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={isSubmitting}>
      <div>
        <h2 className="h2">Envoyer un message</h2>
        <p className="body-s muted v08-form__lead">Tous les champs sont obligatoires.</p>
      </div>

      {errorCount > 0 ? (
        <div className="banner banner--erreur" role="alert">
          <Icon name="i-alert-circle" />
          <div className="banner__body">
            {errorCount} {errorCount > 1 ? "champs à corriger" : "champ à corriger"}{" "}
            avant l&apos;envoi.
          </div>
        </div>
      ) : null}

      {serverError ? (
        <div className="banner banner--erreur" role="alert">
          <Icon name="i-alert-triangle" />
          <div className="banner__body">
            <div className="banner__title">L&apos;envoi a échoué</div>
            {serverError}
          </div>
        </div>
      ) : null}

      <div className="v08-row2">
        <div className="field">
          <label className="field__label" htmlFor="contact-name">
            Nom <span className="req">*</span>
          </label>
          <input
            id="contact-name"
            className={`input${errors.name ? " is-error" : ""}`}
            placeholder="Ex. Sèna Agossou"
            autoComplete="name"
            maxLength={CONTACT_LIMITS.nameMax}
            aria-invalid={errors.name ? "true" : undefined}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            {...register("name")}
          />
          <FieldError id="contact-name-error" message={errors.name?.message} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="contact-email">
            Email <span className="req">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            className={`input${errors.email ? " is-error" : ""}`}
            placeholder="nom@exemple.bj"
            autoComplete="email"
            aria-invalid={errors.email ? "true" : undefined}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            {...register("email")}
          />
          <FieldError id="contact-email-error" message={errors.email?.message} />
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="contact-subject">
          Sujet <span className="req">*</span>
        </label>
        <select
          id="contact-subject"
          className={`select${subject ? "" : " is-placeholder"}${errors.subject ? " is-error" : ""}`}
          aria-invalid={errors.subject ? "true" : undefined}
          aria-describedby={errors.subject ? "contact-subject-error" : undefined}
          {...register("subject")}
        >
          <option value="">Choisir un sujet</option>
          {CONTACT_SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <FieldError id="contact-subject-error" message={errors.subject?.message} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="contact-message">
          Message <span className="req">*</span>
        </label>
        <textarea
          id="contact-message"
          className={`input${errors.message ? " is-error" : ""}`}
          placeholder="Explique ta demande. Si elle concerne une mission, donne son titre."
          aria-invalid={errors.message ? "true" : undefined}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          {...register("message")}
        />
        <FieldError id="contact-message-error" message={errors.message?.message} />
        <div className="field__help">
          <span>Pas de mot de passe ni de code MoMo dans le message.</span>
          <span className="field__count">{formatCount(messageLength, CONTACT_LIMITS.messageMax)}</span>
        </div>
      </div>

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="contact-website">Laisse ce champ vide</label>
        <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" {...register(HONEYPOT_FIELD)} />
      </div>

      <div className="banner banner--info">
        <Icon name="i-flag" />
        <div className="banner__body">
          Un problème sur une mission en cours&nbsp;? Utilise{" "}
          <Link className="link" href="/aide">
            «&nbsp;Signaler&nbsp;»
          </Link>{" "}
          depuis la mission&nbsp;: la libération du paiement peut être suspendue.
        </div>
      </div>

      <button
        type="submit"
        className={`btn btn--accent btn--lg btn--block${isSubmitting ? " is-loading" : ""}`}
        disabled={isSubmitting}
      >
        <span>{serverError ? "Réessayer l'envoi" : "Envoyer le message"}</span>
      </button>
    </form>
  )
}
