"use client"

import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { Drawer } from "@/components/app-ui/drawer"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Stat } from "@/components/app-ui/stats"
import { missionTypeLabel } from "@/lib/constants/missions"
import { clientConversationHref } from "@/lib/app/client-routes"
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
  return Number.isNaN(date.getTime()) ? "" : MONTH_YEAR.format(date)
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
  return (
    <>
      <div className="person2">
        <Avatar name={name} src={student.avatarUrl} />
        <div className="cand2__who">
          {studentSubtitle(student) ? <div className="person2__sub">{studentSubtitle(student)}</div> : null}
        </div>
      </div>
      <div className="actions2">
        {verified ? <StatusBadge label={verified} tone="succes" icon="i-shield" /> : <VerificationBadge student={student} />}
        {candidate.applicationStatus !== "pending" ? <StatusBadge label={status.label} tone={status.tone} /> : null}
      </div>
      <section className="stats2 stats2--3s" aria-label="Indicateurs du candidat">
        <Stat label="Missions" value={Number(student.missionsDone) || 0} />
        <Stat
          label="Note"
          value={rating > 0 ? `${ratingText(rating)} / 5` : "Aucune"}
          sub={candidate.reviewsTotal > 0 ? `${candidate.reviewsTotal} avis` : "Aucun avis"}
        />
        <Stat label="Ville" value={student.city || "Non indiquée"} />
      </section>
      {message ? (
        <section>
          <h3 className="prof2__h">Motivation pour cette mission</h3>
          <p className="prof2__p prof2__p--encre">{message}</p>
          {sent ? <p className="prof2__p">Envoyée le {sent}</p> : null}
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
          {candidate.reviewsTotal > candidate.reviews.length ? (
            <Link className="link2" href={`/talents/${encodeURIComponent(student.id)}`} target="_blank" rel="noopener noreferrer">
              {`Voir les ${candidate.reviewsTotal} avis`}
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
              {monthYear(review.createdAt) ? <p className="prof2__p">{monthYear(review.createdAt)}</p> : null}
            </div>
          ))
        )}
      </section>
      <Link
        className="link2"
        href={`/talents/${encodeURIComponent(student.id)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ouvrir le profil public de ${name} (nouvel onglet)`}
      >
        Ouvrir le profil public
        <Icon name="i-arrow-up-right" />
      </Link>
    </>
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
        className="btn btn--secondary"
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
    <Drawer open onClose={onClose} title={profile ? studentName(candidate.student) : "Profil du candidat"} footer={footer}>
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
    </Drawer>
  )
}

export default CandidateDrawer
