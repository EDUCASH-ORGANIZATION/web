"use client"

import { useId, useRef, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { StarsInput } from "@/components/app-ui/stars-input"
import { TextareaField } from "@/components/app-ui/fields"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Avatar } from "@/components/app-ui/avatar"
import { createStudentReview } from "@/lib/actions/review.actions"
import { escrowSplit } from "@/lib/app/money"
import { COMMISSION_RATE, missionTypeLabel } from "@/lib/constants/missions"
import { formatAmount, formatDateFr } from "@/lib/app/format"
import { studentApplicationsHref, studentMissionHref, studentMissionsHref } from "@/lib/app/student-routes"

export const COMMENT_MAX = 300
// Espace insécable avant « % » : le libellé ne se coupe jamais entre le nombre et le signe.
const COMMISSION_PERCENT = `${Math.round(COMMISSION_RATE * 100)} %`
const ERR_RATING = "Choisissez une note de 1 à 5 étoiles."
const ERR_UNEXPECTED = "Votre avis n'a pas pu être enregistré. Réessayez dans un instant."

export const RATING_LABELS = {
  1: "Très décevant",
  2: "Décevant",
  3: "Correct",
  4: "Bien",
  5: "Excellent",
}

/** Libellé affiché à côté des étoiles : « Excellent », ou l'invitation à choisir. */
export function ratingText(rating) {
  return RATING_LABELS[rating] ?? "Choisissez une note"
}

/**
 * Contrôle local avant l'envoi (le serveur reste l'autorité).
 * @returns {string | null} message d'erreur, ou null si l'avis peut partir
 */
export function validateReview({ rating }) {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? null : ERR_RATING
}

/**
 * Valide puis envoie l'avis. Fonction à dépendance injectée (`create`) : testable sans réseau.
 * @returns {Promise<{ kind: "invalid", error: string } | { kind: "error", error: string } | { kind: "done", review: object }>}
 */
export async function submitReview({ missionId, rating, comment }, create) {
  const invalid = validateReview({ rating })
  if (invalid) return { kind: "invalid", error: invalid }
  try {
    const result = await create({ missionId, rating, comment })
    if (result?.error) return { kind: "error", error: result.error }
    return { kind: "done", review: result?.review ?? { rating, comment: comment || null } }
  } catch {
    return { kind: "error", error: ERR_UNEXPECTED }
  }
}

function StarsDisplay({ rating }) {
  return (
    <span className="stars e2-13-stars e2-13-stars--s" role="img" aria-label={`Note : ${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="i-star" className={n <= rating ? "ic is-on" : "ic"} />
      ))}
    </span>
  )
}

// Titre de page et retour vers la mission. Sur mobile l'en-tête .e2-mtop porte le titre.
function Top({ mission, title, lead }) {
  const back = studentMissionHref(mission.id)
  return (
    <>
      <header className="e2-mtop">
        <Link className="iconbtn2" href={back} aria-label="Retour à la mission">
          <Icon name="i-arrow-left" />
        </Link>
        <span className="e2-mtop__title">{title}</span>
        <span className="e2-mtop__spacer" aria-hidden="true" />
      </header>
      <div className="e2-13-top">
        <Link className="e2-back" href={back}>
          <Icon name="i-arrow-left" />
          {mission.title}
        </Link>
        <PageHead title={title} />
        {lead ? <p className="e2-lead">{lead}</p> : null}
      </div>
    </>
  )
}

function MissionRecap({ mission, client }) {
  const split = escrowSplit(mission.budget)
  return (
    <section className="e2-sec" aria-label="La mission">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">La mission</h2>
        <StatusBadge label="Terminée" tone="succes" icon="i-check" />
      </div>
      <div className="e2-sec__body">
        <div className="e2-who">
          <Avatar name={client.name} src={client.avatarUrl ?? undefined} />
          <div className="e2-13-who">
            <div className="e2-who__name">{client.name}</div>
            <div className="e2-who__sub">{client.city ? `Client · ${client.city}` : "Client"}</div>
          </div>
        </div>
        <div className="e2-kv">
          <div className="e2-kv__row">
            <span>Mission</span>
            <b>{mission.title}</b>
          </div>
          <div className="e2-kv__row">
            <span>Type</span>
            <b>{missionTypeLabel(mission.type)}</b>
          </div>
          <div className="e2-kv__row">
            <span>Budget du client</span>
            <b>{formatAmount(split.total)}</b>
          </div>
          <div className="e2-kv__row">
            <span>Commission EduCash {COMMISSION_PERCENT}</span>
            <b>{formatAmount(split.commission, { sign: "debit" })}</b>
          </div>
          <div className="e2-kv__row e2-kv__row--total">
            <span>Votre part</span>
            <b>{formatAmount(split.student)}</b>
          </div>
        </div>
      </div>
    </section>
  )
}

function ReviewForm({ page, onDone, aside }) {
  const { mission, client } = page
  const uid = useId()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  // Un second clic avant le retour du serveur ne relance jamais l'envoi.
  const busy = useRef(false)
  const formId = `${uid}-form`
  const statusId = `${uid}-rating`
  const legendId = `${uid}-legend`

  async function onSubmit(event) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setSending(true)
    setError("")
    const result = await submitReview({ missionId: mission.id, rating, comment }, createStudentReview)
    busy.current = false
    setSending(false)
    if (result.kind === "done") {
      onDone(result.review)
      return
    }
    // Note et commentaire sont conservés : seul le message change.
    setError(result.error)
  }

  const submitLabel = sending ? "Publication…" : "Publier mon avis"

  return (
    <>
      <div className="e2-cols">
        <section className="card2" aria-label="Votre avis">
          {error ? (
            <div className="e2-note e2-note--blanc" role="alert">
              <Icon name="i-alert-triangle" />
              <div className="e2-note__body">
                <div className="e2-note__title">
                  Publication impossible <StatusBadge label="Erreur" tone="erreur" />
                </div>
                <div className="e2-note__text">{error}</div>
              </div>
            </div>
          ) : null}
          <form id={formId} className="e2-13-form" onSubmit={onSubmit} noValidate>
            <h2 className="hero2__title">Comment s&apos;est passée la mission avec ce client ?</h2>
            <div className="field">
              <span className="field__label" id={legendId}>
                Votre note <span className="req">*</span>
              </span>
              <div className="e2-13-rate">
                <div className="e2-13-stars">
                  <StarsInput value={rating} onChange={setRating} labelledBy={legendId} describedBy={statusId} disabled={sending} />
                </div>
                <span className={rating ? "e2-13-level" : "e2-muted"} id={statusId} aria-live="polite">
                  {ratingText(rating)}
                </span>
              </div>
            </div>
            <TextareaField
              label="Votre commentaire sur ce client"
              optional
              name="comment"
              rows={4}
              maxLength={COMMENT_MAX}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ponctualité, clarté des consignes, validation…"
              help={`Visible sur le profil de ${client.name}${client.name.endsWith(".") ? "" : "."}`}
              disabled={sending}
            />
            <div className="e2-13-actions ds-desk-only">
              <button type="submit" className="btn btn--dark" disabled={rating === 0 || sending}>
                {submitLabel}
              </button>
              <Link className="e2-link" href={studentMissionHref(mission.id)}>
                Plus tard
              </Link>
            </div>
          </form>
        </section>
        {aside}
      </div>
      <div className="e2-mbar">
        <Link className="e2-link e2-link--quiet" href={studentMissionHref(mission.id)}>
          Plus tard
        </Link>
        <span className="e2-mbar__info" />
        <button type="submit" form={formId} className="btn btn--dark" disabled={rating === 0 || sending}>
          {submitLabel}
        </button>
      </div>
    </>
  )
}

function Quote({ review, mission }) {
  return (
    <>
      <div className="e2-13-rate">
        <StarsDisplay rating={review.rating} />
        <b>{ratingText(review.rating)}</b>
      </div>
      {review.comment ? <p className="e2-13-quote">« {review.comment} »</p> : null}
      <span className="caption e2-muted">{mission.title}</span>
    </>
  )
}

export function ThanksCard({ page, review }) {
  const { mission, client } = page
  return (
    <section className="card2" aria-labelledby="review-thanks">
      <div className="e2-empty">
        <span className="e2-empty__ic">
          <Icon name="i-check" />
        </span>
        <h2 className="e2-empty__title" id="review-thanks">
          Merci pour votre avis
        </h2>
        <p className="e2-empty__text">Il apparaît sur le profil de {client.name}.</p>
        <Quote review={review} mission={mission} />
        <div className="e2-empty__actions">
          <Link className="btn btn--dark" href={studentMissionsHref()}>
            Trouver une nouvelle mission
          </Link>
        </div>
        <Link className="e2-link" href={studentApplicationsHref()}>
          Retour à mes candidatures
        </Link>
      </div>
    </section>
  )
}

function AlreadyCard({ page }) {
  const { mission, client, review } = page
  return (
    <section className="card2" aria-labelledby="review-already">
      <span className="hero2__label">Votre avis sur {client.name}</span>
      <h2 className="hero2__title" id="review-already">
        Vous avez déjà noté ce client
      </h2>
      <Quote review={review} mission={mission} />
      <p className="caption e2-muted">
        Publié le {formatDateFr(review.createdAt)}. Un avis ne se modifie pas après son enregistrement.
      </p>
      <div className="hero2__actions">
        <Link className="btn btn--dark" href={studentMissionHref(mission.id)}>
          Retour à la mission
        </Link>
      </div>
    </section>
  )
}

function NotDoneCard({ page }) {
  const { mission } = page
  return (
    <section className="card2" aria-labelledby="review-notdone">
      <span className="hero2__label">{mission.title}</span>
      <h2 className="hero2__title" id="review-notdone">
        Pas encore possible
      </h2>
      <p className="hero2__text">Vous pourrez noter le client une fois la mission terminée.</p>
      <div className="hero2__actions">
        <Link className="btn btn--dark btn--block" href={studentMissionHref(mission.id)}>
          Voir le suivi de la mission
        </Link>
      </div>
    </section>
  )
}

/**
 * E13 Noter le client. Vue sans accès aux données : `page` vient de `getStudentReviewPage`, l'envoi passe par
 * `createStudentReview` (server action). États : formulaire, merci, déjà noté, mission non terminée.
 * @param {{ page: import("@/lib/actions/review.actions").StudentReviewPage }} props
 */
export function ReviewView({ page }) {
  const [done, setDone] = useState(null)
  const { state, mission, client } = page

  let title = "Noter le client"
  let lead = "Votre avis aide les autres étudiants à choisir leurs missions."
  if (done) {
    title = "Avis publié"
    lead = null
  } else if (state === "already") {
    title = "Votre avis"
    lead = null
  } else if (state === "not_done") {
    lead = null
  }

  return (
    <div className="e2-13">
      <Top mission={mission} title={title} lead={lead} />
      {done ? (
        <ThanksCard page={page} review={done} />
      ) : state === "already" ? (
        <AlreadyCard page={page} />
      ) : state === "not_done" ? (
        <NotDoneCard page={page} />
      ) : (
        <ReviewForm
          page={page}
          onDone={setDone}
          aside={
            <div className="e2-stack">
              <MissionRecap mission={mission} client={client} />
            </div>
          }
        />
      )}
    </div>
  )
}

export default ReviewView
