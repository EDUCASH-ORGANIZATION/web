"use client"

import Link from "next/link"
import { useId } from "react"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { CloseButton, useDialogBehavior, useIsCompact, useScrimClose } from "@/components/app-ui/modal"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Stat } from "@/components/app-ui/stats"
import { missionTypeLabel } from "@/lib/constants/missions"
import { clientConversationHref } from "@/lib/app/client-routes"
import { publicTalentHref } from "@/lib/app/student-routes"
import { applicationStatusView } from "@/lib/app/application-status"
import {
  formatWhen,
  isVerifiedNow,
  ratingText,
  studentFirstName,
  studentName,
  studentSubtitle,
  VerificationBadge,
} from "./candidate-row"

const MONTH_YEAR = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "Africa/Porto-Novo" })
const LONG_MONTH_YEAR = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })

function monthYear(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const text = MONTH_YEAR.format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function verifiedLine(student) {
  if (!isVerifiedNow(student)) return null
  const until = student.verifiedUntil ? new Date(student.verifiedUntil) : null
  return until && !Number.isNaN(until.getTime()) ? `Vérifié jusqu'en ${LONG_MONTH_YEAR.format(until)}` : null
}

function Stars({ rating }) {
  const filled = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
  return (
    <span className="review2x__stars" role="img" aria-label={`${filled} sur 5`}>
      {Array.from({ length: filled }, (_, i) => (
        <Icon key={i} name="i-star" />
      ))}
    </span>
  )
}

function Notice({ icon, title, text, children }) {
  return (
    <div className="empty2 empty2--sm" role="status">
      <span className="empty2__ic">
        <Icon name={icon} />
      </span>
      <div className="empty2__title">{title}</div>
      <div className="empty2__text">{text}</div>
      {children}
    </div>
  )
}

function ProfileBody({ candidate }) {
  const { student } = candidate
  const name = studentName(student)
  const rating = Number(student.rating) || 0
  const verified = verifiedLine(student)
  const message = typeof candidate.message === "string" ? candidate.message.trim() : ""
  const sent = formatWhen(candidate.appliedAt, "à")
  const status = applicationStatusView(candidate.applicationStatus)
  const reviewsTotal = Number(candidate.reviewsTotal) || 0
  return (
    <>
      <div className="actions2">
        {verified ? <StatusBadge label={verified} tone="succes" icon="i-shield" /> : <VerificationBadge student={student} />}
        {candidate.applicationStatus !== "pending" ? <StatusBadge label={status.label} tone={status.tone} /> : null}
        {rating > 0 ? (
          <span className="facts2">
            <span>
              <Icon name="i-star" />
              <b>{reviewsTotal > 0 ? `${ratingText(rating)} / 5 · ${reviewsTotal} avis` : `${ratingText(rating)} / 5`}</b>
            </span>
          </span>
        ) : null}
      </div>
      <section className="stats2 stats2--3s" aria-label="Indicateurs du candidat">
        <Stat label="Missions" value={Number(student.missionsDone) || 0} />
        <Stat label="Avis" value={reviewsTotal > 0 ? reviewsTotal : "Aucun"} />
        <Stat label="Ville" value={student.city || "Non indiquée"} />
      </section>
      {message ? (
        <section>
          <h3 className="prof2__h">Motivation pour cette mission</h3>
          <p className="prof2__p prof2__p--encre">{message}</p>
          {sent ? <span className="caption muted">Envoyée le {sent}</span> : null}
        </section>
      ) : null}
      {student.skills.length > 0 ? (
        <section>
          <h3 className="prof2__h">Compétences</h3>
          <div className="tags2">
            {student.skills.map((skill) => (
              <span key={skill}>{missionTypeLabel(skill)}</span>
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <h3 className="prof2__h">
          Avis des clients
          {reviewsTotal > candidate.reviews.length ? (
            <Link className="link2" href={publicTalentHref(student.id)} target="_blank" rel="noopener noreferrer">
              {`Voir les ${reviewsTotal} avis`}
            </Link>
          ) : null}
        </h3>
        {candidate.reviews.length === 0 ? (
          <p className="prof2__p">
            {`${studentFirstName(student) || "Ce candidat"} n'a pas encore d'avis sur EduCash. Discutez avec lui pour vous faire une idée.`}
          </p>
        ) : (
          candidate.reviews.map((review) => (
            <div key={review.id} className="review2x">
              <div className="review2x__top">
                <span>{review.authorFirstName}</span>
                <Stars rating={review.rating} />
              </div>
              {review.comment ? <p className="prof2__p">{review.comment}</p> : null}
              {monthYear(review.createdAt) ? <span className="caption muted">{monthYear(review.createdAt)}</span> : null}
            </div>
          ))
        )}
      </section>
      <Link
        className="link2"
        href={publicTalentHref(student.id)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ouvrir le profil public de ${name} (nouvel onglet)`}
      >
        <Icon name="i-external" />
        Ouvrir le profil public
      </Link>
    </>
  )
}

// Tiroir de la planche C05 : l'en-tête porte l'avatar (56 px), le nom et le sous-titre, ce que le tiroir partagé
// (titre seul) ne permet pas. Mêmes garanties que lui : piège de focus, Échap, fermeture par le voile, plein écran
// sous 1024 px. Le titre accessible est le nom du candidat.
function ProfileDrawer({ onClose, name, avatarUrl, subtitle, footer, children }) {
  const titleId = `${useId()}-title`
  const compact = useIsCompact()
  const containerRef = useDialogBehavior({ onClose })
  const scrim = useScrimClose(onClose)
  return (
    <div className="scrim scrim--right ds-scrim-fixed" onPointerDown={scrim.onPointerDown} onClick={scrim.onClick}>
      <aside
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={compact ? "drawer ds-drawer--full" : "drawer"}
      >
        <div className="drawer__head">
          <Avatar name={name} src={avatarUrl} />
          <div>
            <h2 id={titleId} className="ds-h3">
              {name}
            </h2>
            {subtitle ? <div className="caption muted">{subtitle}</div> : null}
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className="drawer__body">{children}</div>
        {footer ? <div className="drawer__foot">{footer}</div> : null}
      </aside>
    </div>
  )
}

/**
 * Tiroir « Profil du candidat » (C05). Ouvert par `?candidat=` : la page lit le profil et le passe ici.
 * États : profil (vérifié ou non, avec ou sans avis), `error` (lecture en échec : « Profil indisponible »),
 * `candidate` nul sans erreur (candidature retirée ou introuvable). Les actions ne sont proposées que pour
 * une candidature en attente. `onAccept` et `onReject` reçoivent `{ id, studentId, student }` et le déclencheur.
 */
export function CandidateDrawer({ open, candidate, error = false, missionId, onClose, onRetry, onAccept, onReject }) {
  if (!open) return null
  const profile = Boolean(candidate)
  const pending = profile && candidate.applicationStatus === "pending"
  const applicant = profile ? { id: candidate.applicationId, studentId: candidate.studentId, student: candidate.student } : null
  const first = profile ? studentFirstName(candidate.student) : ""

  const footer = profile ? (
    <>
      <Link
        className="btn btn--soft"
        href={clientConversationHref(missionId, candidate.studentId)}
        aria-label={`Discuter avec ${studentName(candidate.student)}`}
      >
        <Icon name="i-message" />
        Discuter
      </Link>
      {pending ? (
        <>
          <button
            type="button"
            className="link2 cand2__link cand2__link--muted"
            aria-label={`Refuser la candidature de ${studentName(candidate.student)}`}
            onClick={(e) => onReject(applicant, e.currentTarget)}
          >
            Refuser
          </button>
          <button type="button" className="btn btn--dark" onClick={(e) => onAccept(applicant, e.currentTarget)}>
            <Icon name="i-check" />
            {first ? `Accepter ${first}` : "Accepter"}
          </button>
        </>
      ) : null}
    </>
  ) : null

  return (
    <ProfileDrawer
      onClose={onClose}
      name={profile ? studentName(candidate.student) : "Profil du candidat"}
      avatarUrl={profile ? candidate.student.avatarUrl : null}
      subtitle={profile ? studentSubtitle(candidate.student) : ""}
      footer={footer}
    >
      {profile ? (
        <ProfileBody candidate={candidate} />
      ) : error ? (
        <Notice icon="i-alert-triangle" title="Profil indisponible" text="Le profil de ce candidat n'a pas pu être chargé. Votre mission et vos fonds ne sont pas concernés.">
          <button type="button" className="btn btn--soft btn--sm" onClick={onRetry}>
            <Icon name="i-refresh" />
            Réessayer
          </button>
        </Notice>
      ) : (
        <Notice
          icon="i-user"
          title="Candidature retirée ou introuvable"
          text="Cette candidature n'existe plus ou a été retirée. Retournez à la liste pour voir les candidatures en cours."
        />
      )}
    </ProfileDrawer>
  )
}

export default CandidateDrawer
