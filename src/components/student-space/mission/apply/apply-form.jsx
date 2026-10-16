"use client"

// @ds-screen RD-STUDENT-01
// Bloc de candidature de l'étudiant (E03) : colonne au bureau, barre fixe + feuille du bas en mobile.
// Interface seulement : l'action `apply` reste l'unique autorité (rôle, vérification, mission ouverte, doublon).
// Un paramètre d'URL (`?postuler=1`) ouvre la feuille, il n'envoie jamais rien.
import { useRef, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Modal, useIsCompact } from "@/components/app-ui/modal"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { TextareaField } from "@/components/app-ui/fields"
import { splitAmount } from "@/components/app-ui/amount"
import { apply } from "@/lib/actions/application.actions"
import { applicationStatusView } from "@/lib/app/application-status"
import { formatAmount, formatDateFr } from "@/lib/app/format"
import { studentApplicationsHref, studentMissionsHref, studentVerifyHref } from "@/lib/app/student-routes"
import { GainRecap, STUDENT_PERCENT } from "./gain-recap"

export const MESSAGE_MAX = 500
export const MESSAGE_REQUIRED = "Écrivez quelques mots pour vous présenter au client."
const FALLBACK_ERROR = "Une erreur est survenue. Réessayez dans un instant."

const VERIFICATION_TONE = {
  verified: "succes",
  pending: "neutre",
  expiring: "alerte",
  not_submitted: "neutre",
  rejected: "erreur",
  expired: "erreur",
}

/**
 * Même minimum que l'action `apply` : un message non vide une fois épuré, 500 caractères au plus.
 * @param {string} text
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateMessage(text) {
  const value = typeof text === "string" ? text.trim() : ""
  if (!value) return { ok: false, error: MESSAGE_REQUIRED }
  if (value.length > MESSAGE_MAX) return { ok: false, error: `Le message ne doit pas dépasser ${MESSAGE_MAX} caractères.` }
  return { ok: true, value }
}

/**
 * Envoi unique : `guard` ({ current }) est un verrou synchrone, un double clic n'appelle `send` qu'une fois (l'état
 * React ne se met à jour qu'au rendu suivant). Le verrou est rendu après un refus ou une exception, pour permettre
 * une nouvelle tentative ; il reste posé après un succès. Renvoie { skipped } | { invalid } | { error } | { done, message }.
 * @param {{ current: boolean }} guard
 * @param {{ missionId: string, message: string, send: (input: { missionId: string, message: string }) => Promise<{ error?: string }|undefined> }} input
 */
export async function submitApplication(guard, { missionId, message, send }) {
  if (guard.current) return { skipped: true }
  const check = validateMessage(message)
  if (!check.ok) return { invalid: check.error }
  guard.current = true
  try {
    const result = await send({ missionId, message: check.value })
    if (result?.error) {
      guard.current = false
      return { error: result.error }
    }
    return { done: true, message: check.value }
  } catch {
    guard.current = false
    return { error: FALLBACK_ERROR }
  }
}

function ServerError({ error }) {
  if (!error) return null
  return (
    <div className="field__error" role="alert">
      <Icon name="i-alert-circle" />
      {error}
    </div>
  )
}

function ApplicationBadge({ status }) {
  const view = applicationStatusView(status)
  return <StatusBadge label={view.label} tone={view.tone} />
}

function sentOn(createdAt) {
  return createdAt ? `Envoyée le ${formatDateFr(createdAt)}. ` : ""
}

function DeskBody({
  mode, split, purchases, verification, application, sent, note, message, fieldError, serverError, pending, onMessage, onSubmit, textareaRef,
}) {
  if (mode === "applied") {
    return (
      <>
        <div className="e2-note" role={sent ? "status" : undefined}>
          <Icon name="i-check-circle" />
          <div className="e2-note__body">
            <div className="e2-note__title">Candidature envoyée</div>
            <div className="e2-note__text">{`${sentOn(application.createdAt)}Suivez son statut dans vos candidatures.`}</div>
          </div>
        </div>
        {application.message ? <p className="e2-03-msg">{application.message}</p> : null}
        <Link className={sent ? "btn btn--dark btn--block" : "btn btn--soft btn--block"} href={studentApplicationsHref()}>
          Suivre ma candidature
        </Link>
      </>
    )
  }
  if (mode === "overdue") {
    return (
      <>
        {note}
        <Link className="btn btn--soft btn--block" href={studentMissionsHref()}>
          Voir d&apos;autres missions
        </Link>
      </>
    )
  }
  if (mode === "blocked") {
    return (
      <>
        {note}
        {split ? <GainRecap split={split} purchases={purchases} /> : null}
        <Link className="btn btn--dark btn--block" href={verification?.action?.href ?? studentVerifyHref()}>
          <Icon name="i-id-card" />
          {verification?.action?.label ?? "Envoyer ma carte"}
        </Link>
      </>
    )
  }
  return (
    <>
      {note}
      <TextareaField
        className="e2-03-ta"
        label="Votre motivation"
        required
        maxLength={MESSAGE_MAX}
        help="Expérience, disponibilités."
        error={fieldError}
        value={message}
        onChange={onMessage}
        ref={textareaRef}
      />
      {split ? <GainRecap split={split} purchases={purchases} /> : null}
      <ServerError error={serverError} />
      <button
        type="button"
        className="btn btn--dark btn--block"
        onClick={onSubmit}
        disabled={pending}
        aria-busy={pending ? "true" : undefined}
      >
        {pending ? "Envoi en cours" : "Envoyer ma candidature"}
      </button>
      <p className="e2-03-caption">Votre message est transmis au client avec votre candidature.</p>
    </>
  )
}

function DeskBlock({ mode, verification, application, ...body }) {
  const badge =
    mode === "applied" ? (
      <ApplicationBadge status={application.status} />
    ) : verification ? (
      <StatusBadge
        label={verification.key === "verified" ? "Vérifiée" : verification.label}
        tone={VERIFICATION_TONE[verification.key]}
        icon={verification.key === "verified" ? "i-shield" : undefined}
      />
    ) : null
  return (
    <section className="e2-sec ds-desk-only" aria-label="Postuler">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Postuler</h2>
        {badge}
      </div>
      <div className="e2-sec__body">
        <DeskBody mode={mode} verification={verification} application={application} {...body} />
      </div>
    </section>
  )
}

function BarInfo({ split, purchases }) {
  if (!split) return <div className="e2-mbar__info" />
  const { text, unit } = splitAmount(split.student)
  return (
    <div className="e2-mbar__info e2-03-info">
      <span className="e2-amount e2-amount--s">
        {text}
        <small>{unit}</small>
      </span>
      <small>
        {purchases
          ? `Service · vous touchez ${STUDENT_PERCENT} % · achats hors EduCash`
          : `Vous touchez (${STUDENT_PERCENT} %) · budget ${formatAmount(split.total)}`}
      </small>
    </div>
  )
}

function MobileBar({ mode, split, purchases, verification, application, sent, onOpenSheet }) {
  if (mode === "form") {
    return (
      <div className="e2-mbar">
        <BarInfo split={split} purchases={purchases} />
        <button type="button" className="btn btn--dark" onClick={onOpenSheet}>
          Postuler
        </button>
      </div>
    )
  }
  if (mode === "blocked") {
    return (
      <div className="e2-mbar e2-mbar--stack">
        <BarInfo split={split} purchases={purchases} />
        <Link className="btn btn--dark btn--block" href={verification?.action?.href ?? studentVerifyHref()}>
          <Icon name="i-id-card" />
          {verification?.action?.label ?? "Envoyer ma carte"}
        </Link>
      </div>
    )
  }
  if (mode === "applied") {
    const status = applicationStatusView(application.status)
    return (
      <div className="e2-mbar">
        <div className="e2-mbar__info e2-03-info" role={sent ? "status" : undefined}>
          <StatusBadge label={status.label} tone={status.tone} />
          <small>
            {split
              ? `${sent ? "Candidature envoyée" : "Candidature en cours"} · vous toucheriez ${formatAmount(split.student)}`
              : sent
                ? "Candidature envoyée"
                : "Candidature en cours"}
          </small>
        </div>
        <Link className="btn btn--soft" href={studentApplicationsHref()}>
          Suivre
          <span className="sr-only"> ma candidature</span>
        </Link>
      </div>
    )
  }
  return null
}

/**
 * Vue pure du bloc de candidature : tout l'état vient de l'extérieur (voir ApplyPanel), ce qui permet de tester
 * chaque état. `mode` : "form" (peut candidater) | "blocked" (vérification à faire) | "overdue" (échéance dépassée) |
 * "applied" (candidature envoyée, `application` renseignée). `note` est le bloc d'explication déjà rendu.
 */
export function ApplyPanelView({
  mode, mission, clientName, split, purchases, verification, application, sent, note, message, fieldError, serverError, pending,
  sheetOpen, textareaRef, onMessage, onSubmit, onOpenSheet, onCloseSheet,
}) {
  return (
    <>
      <DeskBlock
        mode={mode}
        split={split}
        purchases={purchases}
        verification={verification}
        application={application}
        sent={sent}
        note={note}
        message={message}
        fieldError={fieldError}
        serverError={serverError}
        pending={pending}
        onMessage={onMessage}
        onSubmit={onSubmit}
        textareaRef={textareaRef}
      />
      <MobileBar
        mode={mode}
        split={split}
        purchases={purchases}
        verification={verification}
        application={application}
        sent={sent}
        onOpenSheet={onOpenSheet}
      />
      <Modal
        open={sheetOpen && mode === "form"}
        onClose={onCloseSheet}
        title="Postuler"
        description={`${mission.title} · ${clientName}`}
        initialFocusRef={textareaRef}
        footer={
          <>
            <button type="button" className="btn btn--soft" onClick={onCloseSheet} disabled={pending}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn--dark"
              onClick={onSubmit}
              disabled={pending}
              aria-busy={pending ? "true" : undefined}
            >
              {pending ? "Envoi en cours" : "Envoyer ma candidature"}
            </button>
          </>
        }
      >
        <TextareaField
          className="e2-03-ta e2-03-ta--s"
          label="Votre motivation"
          required
          maxLength={MESSAGE_MAX}
          help="Expérience, disponibilités."
          error={fieldError}
          value={message}
          onChange={onMessage}
          ref={textareaRef}
        />
        {split ? <GainRecap split={split} purchases={purchases} /> : null}
        <ServerError error={serverError} />
        <p className="e2-03-caption">Votre message est transmis au client avec votre candidature.</p>
      </Modal>
    </>
  )
}

/**
 * Bloc de candidature avec son état : motivation, envoi par `apply`, confirmation, erreur serveur affichée telle
 * quelle (la motivation est conservée), feuille du bas en mobile (`initialSheet` = `?postuler=1`).
 *
 * @param {{
 *   mode: "form" | "blocked" | "overdue" | "applied",
 *   mission: { id: string, title: string },
 *   clientName: string,
 *   split: { total: number, commission: number, student: number } | null,
 *   purchases?: number|null,
 *   verification: import("@/lib/student-space/verification-status").VerificationView | null,
 *   application: { status: string, createdAt: string|null, message: string } | null,
 *   note?: import("react").ReactNode,
 *   initialSheet?: boolean
 * }} props
 */
export function ApplyPanel({
  mode, mission, clientName, split, purchases = null, verification, application, note, initialSheet = false,
}) {
  const [message, setMessage] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [serverError, setServerError] = useState("")
  const [pending, setPending] = useState(false)
  const [sentMessage, setSentMessage] = useState(null)
  const [sheetWanted, setSheetWanted] = useState(initialSheet)
  const guard = useRef(false)
  const textareaRef = useRef(null)
  const compact = useIsCompact()

  const sent = sentMessage !== null
  const effective = sent
    ? { mode: "applied", application: { status: "pending", createdAt: null, message: sentMessage } }
    : { mode, application }

  const onMessage = (event) => {
    setMessage(event.target.value.slice(0, MESSAGE_MAX))
    setFieldError("")
  }

  const onSubmit = async () => {
    if (guard.current) return
    setServerError("")
    const check = validateMessage(message)
    if (!check.ok) {
      setFieldError(check.error)
      return
    }
    setFieldError("")
    setPending(true)
    const outcome = await submitApplication(guard, { missionId: mission.id, message, send: apply })
    setPending(false)
    if (outcome.error) setServerError(outcome.error)
    if (outcome.done) {
      setSentMessage(outcome.message)
      setSheetWanted(false)
    }
  }

  return (
    <ApplyPanelView
      mode={effective.mode}
      mission={mission}
      clientName={clientName}
      split={split}
      purchases={purchases}
      verification={verification}
      application={effective.application}
      sent={sent}
      note={note}
      message={message}
      fieldError={fieldError}
      serverError={serverError}
      pending={pending}
      sheetOpen={sheetWanted && compact}
      textareaRef={textareaRef}
      onMessage={onMessage}
      onSubmit={onSubmit}
      onOpenSheet={() => setSheetWanted(true)}
      onCloseSheet={() => setSheetWanted(false)}
    />
  )
}

export default ApplyPanel
