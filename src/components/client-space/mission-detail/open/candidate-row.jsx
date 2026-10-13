"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { applicationStatusView } from "@/lib/app/application-status"
import { firstName } from "@/lib/vitrine/public-name"

const BENIN_TZ = "Africa/Porto-Novo"
const FALLBACK_NAME = "Étudiant EduCash"
// Au-delà, le message est replié sur 2 lignes et dépliable (le rendu serveur ne peut pas mesurer le texte).
export const MESSAGE_CLAMP_CHARS = 140

const cx = (...parts) => parts.filter(Boolean).join(" ")

/** Vérification encore valable : `is_verified` vrai et date de fin absente ou à venir. */
export function isVerifiedNow(student, now = Date.now()) {
  if (!student?.isVerified) return false
  if (!student.verifiedUntil) return true
  return new Date(student.verifiedUntil).getTime() > now
}

export function studentName(student) {
  const name = typeof student?.fullName === "string" ? student.fullName.trim() : ""
  return name || FALLBACK_NAME
}

/** Prénom pour les boutons et les titres ; chaîne vide si le nom est inconnu. */
export function studentFirstName(student) {
  const name = typeof student?.fullName === "string" ? student.fullName.trim() : ""
  return name ? firstName(name, { fallback: "" }) : ""
}

/** « Master 1 Lettres modernes · UAC » : niveau puis école, ce qui existe. */
export function studentSubtitle(student) {
  return [student?.level, student?.school].filter(Boolean).join(" · ")
}

export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

export function ratingText(rating) {
  return (Number(rating) || 0).toFixed(1).replace(".", ",")
}

export function missionsText(count) {
  const n = Number(count) || 0
  return `${n} mission${n > 1 ? "s" : ""}`
}

/**
 * Date et heure au Bénin, ex. « 6 oct. · 09:12 » (joiner « · ») ou « 6 oct. à 18:12 » (joiner « à »).
 * Chaîne vide si la date est absente ou invalide.
 */
export function formatWhen(iso, joiner = "·") {
  const date = new Date(iso)
  if (!iso || Number.isNaN(date.getTime())) return ""
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: BENIN_TZ }).format(date)
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: BENIN_TZ }).format(date)
  return `${day} ${joiner} ${time}`
}

/** Jour et mois au Bénin, ex. « 6 oct. » ; chaîne vide si la date est absente ou invalide. */
export function formatDay(iso) {
  const date = new Date(iso)
  if (!iso || Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: BENIN_TZ }).format(date)
}

/** Badge de vérification : « Vérifié » ou « Non vérifié » (aucun autre état n'est exposé). */
export function VerificationBadge({ student }) {
  return isVerifiedNow(student) ? (
    <StatusBadge label="Vérifié" tone="succes" icon="i-shield" />
  ) : (
    <StatusBadge label="Non vérifié" tone="neutre" />
  )
}

/** Faits sobres en ligne : note, missions, ville. */
export function StudentFacts({ student }) {
  const rating = Number(student.rating) || 0
  return (
    <div className="facts2">
      <span>
        <Icon name="i-star" />
        {rating > 0 ? (
          <>
            <b>{ratingText(rating)}</b>
            {" / 5"}
          </>
        ) : (
          "Aucun avis"
        )}
      </span>
      <span>
        <Icon name="i-briefcase" />
        {missionsText(student.missionsDone)}
      </span>
      {student.city ? (
        <span>
          <Icon name="i-map-pin" />
          {student.city}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Rangée de candidature (C04). `application` : élément de `detail.applications`.
 * Seule une candidature en attente propose Refuser et Accepter ; les autres sont en retrait.
 * `onAccept(application, element)` et `onReject(application, element)` reçoivent le déclencheur
 * pour lui rendre le focus à la fermeture de la boîte.
 */
export function CandidateRow({ application, profileHref, chatHref, onProfileOpen, onAccept, onReject, defaultExpanded = false }) {
  const { student } = application
  const name = studentName(student)
  const first = studentFirstName(student)
  const pending = application.status === "pending"
  const message = typeof application.message === "string" ? application.message.trim() : ""
  const long = message.length > MESSAGE_CLAMP_CHARS
  const [expanded, setExpanded] = useState(defaultExpanded)
  const messageId = useId()
  const status = applicationStatusView(application.status)

  return (
    <div role="listitem" className={cx("cand2", !pending && "cand2--muted")}>
      <div className="cand2__top">
        <div className="person2">
          <Avatar name={name} src={student.avatarUrl} />
          <div className="cand2__who">
            <div className="person2__name">{name}</div>
            {studentSubtitle(student) ? <div className="person2__sub">{studentSubtitle(student)}</div> : null}
          </div>
        </div>
        {pending ? <VerificationBadge student={student} /> : <StatusBadge label={status.label} tone={status.tone} />}
      </div>
      <StudentFacts student={student} />
      {message ? (
        <>
          <p id={messageId} className={cx("cand2__msg", long && !expanded && "cand2__msg--clamp")}>
            {message}
          </p>
          {long ? (
            <button
              type="button"
              className="link2 cand2__link"
              aria-expanded={expanded}
              aria-controls={messageId}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Réduire le message" : "Lire la suite"}
            </button>
          ) : null}
        </>
      ) : null}
      <div className="cand2__acts">
        <Link
          className="link2 cand2__link"
          href={profileHref}
          scroll={false}
          aria-label={`Voir le profil de ${name}`}
          onClick={(e) => onProfileOpen?.(e.currentTarget)}
        >
          <Icon name="i-user" />
          Voir le profil
        </Link>
        {pending ? (
          <>
            <Link className="link2 cand2__link" href={chatHref} aria-label={`Discuter avec ${name}`}>
              <Icon name="i-message" />
              Discuter
            </Link>
            <button
              type="button"
              className="link2 cand2__link cand2__link--muted"
              aria-label={`Refuser la candidature de ${name}`}
              onClick={(e) => onReject(application, e.currentTarget)}
            >
              Refuser
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={(e) => onAccept(application, e.currentTarget)}>
              <Icon name="i-check" />
              {first ? `Accepter ${first}` : "Accepter"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default CandidateRow
