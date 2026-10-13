"use client"

import { useId, useRef, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { StarsInput } from "@/components/app-ui/stars-input"
import { TextareaField } from "@/components/app-ui/fields"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Avatar } from "@/components/app-ui/avatar"
import { createClientReview } from "@/lib/actions/review.actions"
import { escrowSplit } from "@/lib/app/money"
import { formatAmount, formatDateFr } from "@/lib/app/format"
import { clientMissionHref, clientMissionsHref } from "@/lib/app/client-routes"
import { firstName, publicDisplayName } from "@/lib/vitrine/public-name"

export const COMMENT_MAX = 300
const ERR_RATING = "Choisissez une note de 1 à 5 étoiles."
const ERR_UNEXPECTED = "Votre avis n'a pas pu être enregistré. Réessayez dans un instant."

export const RATING_LABELS = {
  1: "Très décevant",
  2: "Décevant",
  3: "Correct",
  4: "Bien",
  5: "Excellent",
}

/** Libellé affiché sous les étoiles : « Excellent · 5 / 5 », ou l'invitation à choisir. */
export function ratingText(rating) {
  return RATING_LABELS[rating] ? `${RATING_LABELS[rating]} · ${rating} / 5` : "Choisissez une note"
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

// Signature publique de l'avis : « Rosine H. » (jamais le nom complet).
function signature(authorName) {
  return typeof authorName === "string" && authorName.trim() ? publicDisplayName(authorName) : "Client"
}

function StarsDisplay({ rating }) {
  return (
    <span className="stars" role="img" aria-label={`Note : ${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="i-star" className={n <= rating ? "ic is-on" : "ic"} />
      ))}
    </span>
  )
}

function MissionRecap({ mission, student }) {
  const split = escrowSplit(mission.budget)
  const name = firstName(student?.fullName, { fallback: "l'étudiant" })
  return (
    <section className="card2" aria-label="La mission">
      <div className="sec2">
        <h2 className="sec2__title">La mission</h2>
      </div>
      <div className="actions2">
        <StatusBadge label="Terminée" tone="succes" icon="i-check" />
      </div>
      <div className="lines2">
        <div className="lines2__row">
          <span>Mission</span>
          <b>{mission.title}</b>
        </div>
        {student ? (
          <div className="lines2__row">
            <span>Étudiant</span>
            <b>{publicDisplayName(student.fullName)}</b>
          </div>
        ) : null}
        <div className="lines2__row">
          <span>Budget</span>
          <b>{formatAmount(split.total)}</b>
        </div>
        <div className="lines2__row">
          <span>Commission 12 %</span>
          <b>{formatAmount(split.commission, { sign: "debit" })}</b>
        </div>
        <div className="lines2__row lines2__row--total">
          <span>Versé à {name}</span>
          <b>{formatAmount(split.student)}</b>
        </div>
      </div>
      <Link className="link2" href={clientMissionHref(mission.id)}>
        Voir la mission et le reçu
      </Link>
    </section>
  )
}

function ReviewRules({ authorName, studentName }) {
  return (
    <section className="card2" aria-label="Votre avis">
      <div className="sec2">
        <h2 className="sec2__title">Votre avis</h2>
      </div>
      <ul className="checklist">
        <li className="is-ok">
          Signé « {signature(authorName)} » sur le profil de {studentName}
        </li>
        <li className="is-ok">Un avis ne se modifie pas après son enregistrement</li>
        <li className="is-ok">Une seule fois par mission</li>
      </ul>
    </section>
  )
}

function ReviewForm({ page, onDone }) {
  const { mission, student, authorName } = page
  const uid = useId()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  // Un second clic avant le retour du serveur ne relance jamais l'envoi.
  const busy = useRef(false)
  const name = firstName(student?.fullName, { fallback: "l'étudiant" })
  const statusId = `${uid}-rating`
  const errorId = `${uid}-error`

  async function onSubmit(event) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setSending(true)
    setError("")
    const result = await submitReview({ missionId: mission.id, rating, comment }, createClientReview)
    busy.current = false
    setSending(false)
    if (result.kind === "done") {
      onDone(result.review)
      return
    }
    // Note et commentaire sont conservés : seul le message change.
    setError(result.error)
  }

  return (
    <section className="card2 form2" aria-labelledby={`${uid}-title`}>
      {error ? (
        <div className="banner banner--erreur" role="alert" id={errorId}>
          <Icon name="i-alert-circle" />
          <div className="banner__body">
            <div className="banner__title">Votre avis n&apos;a pas été enregistré</div>
            {error}
          </div>
        </div>
      ) : null}
      <form className="form2" onSubmit={onSubmit} noValidate>
        <div className="person2 person2--lg">
          <Avatar name={student?.fullName ?? ""} src={student?.avatarUrl ?? undefined} />
          <div className="review2__who">
            <h2 className="person2__name" id={`${uid}-title`}>
              Comment s&apos;est passée la mission avec {name} ?
            </h2>
            <div className="person2__sub">Votre note compte pour sa réputation et aide les autres clients à choisir.</div>
          </div>
        </div>

        <div className="rate2">
          <StarsInput value={rating} onChange={setRating} label="Note sur 5" describedBy={statusId} disabled={sending} />
          <span className="rate2__label" id={statusId} aria-live="polite">
            {ratingText(rating)}
          </span>
        </div>

        <TextareaField
          label="Votre commentaire"
          optional
          name="comment"
          rows={4}
          maxLength={COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ponctualité, soin, communication : ce qui aidera les prochains clients."
          help={`Public, signé « ${signature(authorName)} ».`}
          disabled={sending}
        />

        <div className="form2__foot">
          <Link className="link2 link2--muted" href={clientMissionHref(mission.id)}>
            Plus tard
          </Link>
          <button type="submit" className="btn btn--dark" disabled={rating === 0 || sending}>
            <Icon name="i-star" />
            {sending ? "Enregistrement…" : "Enregistrer mon avis"}
          </button>
        </div>
      </form>
    </section>
  )
}

export function ThanksCard({ page, review }) {
  const { mission, student, authorName } = page
  const name = firstName(student?.fullName, { fallback: "l'étudiant" })
  return (
    <section className="card2 done2" aria-labelledby="review-thanks">
      <span className="done2__mark">
        <Icon name="i-star" />
      </span>
      <h2 className="done2__title" id="review-thanks">
        Merci
      </h2>
      <p className="done2__text">
        Votre avis est enregistré. Il est visible sur le profil de <b>{name}</b>.
      </p>
      <div className="quote2">
        <div className="quote2__top">
          <span>{signature(authorName)}</span>
          <StarsDisplay rating={review.rating} />
        </div>
        {review.comment ? <p className="prof2__p">{review.comment}</p> : null}
        <span className="caption muted">{mission.title}</span>
      </div>
      <div className="actions2">
        <Link className="btn btn--dark" href="/client/dashboard">
          Retour à l&apos;accueil
        </Link>
        <Link className="link2" href={clientMissionsHref()}>
          Voir mes missions
        </Link>
      </div>
    </section>
  )
}

function AlreadyCard({ page }) {
  const { mission, student, review, authorName } = page
  const name = firstName(student?.fullName, { fallback: "l'étudiant" })
  return (
    <section className="card2 done2" aria-labelledby="review-already">
      <span className="done2__mark">
        <Icon name="i-check" />
      </span>
      <h2 className="done2__title" id="review-already">
        Vous avez déjà noté {name} pour cette mission
      </h2>
      <p className="done2__text">
        Le {formatDateFr(review.createdAt)}. Un avis ne se modifie pas ; en cas de souci, écrivez-nous depuis la page{" "}
        <Link className="link2" href="/contact?sujet=question">
          Contact
        </Link>
        .
      </p>
      <div className="quote2">
        <div className="quote2__top">
          <span>{signature(authorName)}</span>
          <StarsDisplay rating={review.rating} />
        </div>
        {review.comment ? <p className="prof2__p">{review.comment}</p> : null}
        <span className="caption muted">{mission.title}</span>
      </div>
      <div className="actions2">
        {student ? (
          <Link className="btn btn--soft btn--sm" href={`/talents/${encodeURIComponent(student.id)}`}>
            Voir le profil de {name}
          </Link>
        ) : null}
        <Link className="link2" href={clientMissionHref(mission.id)}>
          Retour à la mission
        </Link>
      </div>
    </section>
  )
}

function NotDoneCard({ page }) {
  const { mission, student } = page
  const name = firstName(student?.fullName, { fallback: "l'étudiant" })
  const inProgress = mission.status === "in_progress" && student
  return (
    <section className="card2 done2" aria-labelledby="review-notdone">
      <span className="done2__mark done2__mark--alerte">
        <Icon name="i-clock" />
      </span>
      <h2 className="done2__title" id="review-notdone">
        Pas encore de note possible
      </h2>
      <p className="done2__text">
        {inProgress
          ? `La mission « ${mission.title} » est toujours en cours. Vous pourrez noter ${name} dès que vous aurez confirmé la fin de la mission.`
          : `La mission « ${mission.title} » n'est pas terminée : vous pourrez noter l'étudiant retenu une fois la mission terminée.`}
      </p>
      <div className="actions2">
        <Link className="btn btn--soft btn--sm" href={clientMissionHref(mission.id)}>
          Voir la mission
        </Link>
      </div>
    </section>
  )
}

/**
 * Noter l'étudiant (C10). Vue sans accès aux données : `page` vient de `getClientReviewPage`, l'envoi
 * passe par `createClientReview` (server action). États : formulaire, merci, déjà noté, mission non terminée.
 * @param {{ page: import("@/lib/actions/review.actions").ClientReviewPage }} props
 */
export function ReviewView({ page }) {
  const [done, setDone] = useState(null)
  const { state, mission, student, authorName } = page
  const name = firstName(student?.fullName, { fallback: "l'étudiant" })

  let title = `Noter ${name}`
  if (done) title = "Avis enregistré"
  else if (state === "already") title = `Votre avis sur ${name}`
  else if (state === "not_done") title = "Noter l'étudiant"

  return (
    <div className="review2">
      <PageHead date={mission.title} title={title} />
      {done ? (
        <ThanksCard page={page} review={done} />
      ) : state === "already" ? (
        <AlreadyCard page={page} />
      ) : state === "not_done" ? (
        <NotDoneCard page={page} />
      ) : (
        <div className="split2">
          <ReviewForm page={page} onDone={setDone} />
          <div className="col2">
            <MissionRecap mission={mission} student={student} />
            <ReviewRules authorName={authorName} studentName={name} />
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewView
