"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { applicationStatusView } from "@/lib/app/application-status"
import { firstName } from "@/lib/vitrine/public-name"

const BENIN_TZ = "Africa/Porto-Novo"
const FALLBACK_NAME = "Étudiant EduCash"
// Le message est toujours replié sur 2 lignes ; « Lire la suite » n'apparaît que s'il est réellement rogné. Le rendu
// serveur ne peut pas mesurer le texte : au-delà de ce nombre de caractères il suppose le message rogné, la mesure
// faite après l'affichage (useIsClamped) corrige ensuite.
export const MESSAGE_CLAMP_CHARS = 190

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

/** Sous-titre mobile de la planche : « 4,8 / 5 · 14 missions » (la note seulement s'il y a des avis). */
export function studentMobileSubtitle(student) {
  const rating = Number(student?.rating) || 0
  return [rating > 0 ? `${ratingText(rating)} / 5` : "", missionsText(student?.missionsDone)].filter(Boolean).join(" · ")
}

/** Faits sobres en ligne : note, missions, ville (bureau seulement : le mobile les résume sous le nom). */
export function StudentFacts({ student }) {
  const rating = Number(student.rating) || 0
  return (
    <div className="facts2 ds-desk-only">
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

/** Vrai si le texte du paragraphe est rogné par le repli sur 2 lignes ; `guess` sert avant la première mesure. */
function useIsClamped(ref, enabled, guess) {
  const [clamped, setClamped] = useState(guess)
  useEffect(() => {
    const element = ref.current
    if (!enabled || !element) return undefined
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, enabled])
  return clamped
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
  const [expanded, setExpanded] = useState(defaultExpanded)
  const messageRef = useRef(null)
  const clamped = useIsClamped(messageRef, Boolean(message) && !expanded, message.length > MESSAGE_CLAMP_CHARS)
  const messageId = useId()
  const status = applicationStatusView(application.status)

  return (
    <div role="listitem" className={cx("cand2", !pending && "cand2--muted")}>
      <div className="cand2__top">
        <div className="person2">
          <Avatar name={name} src={student.avatarUrl} />
          <div className="cand2__who">
            <div className="person2__name">{name}</div>
            {studentSubtitle(student) ? <div className="person2__sub ds-desk-only">{studentSubtitle(student)}</div> : null}
            <div className="person2__sub ds-mob-only">{studentMobileSubtitle(student)}</div>
          </div>
        </div>
        {pending ? <VerificationBadge student={student} /> : <StatusBadge label={status.label} tone={status.tone} />}
      </div>
      <StudentFacts student={student} />
      {message ? (
        <>
          <p ref={messageRef} id={messageId} className={cx("cand2__msg", !expanded && "cand2__msg--clamp")}>
            {message}
          </p>
          {expanded || clamped ? (
            <button
              type="button"
              className="link2 cand2__link ds-desk-only"
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
          <Icon name="i-user" className="ic ds-desk-only" />
          <span>
            <span className="ds-desk-only">Voir le profil</span>
            <span className="ds-mob-only">Profil</span>
          </span>
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
            <button type="button" className="btn btn--soft btn--sm" onClick={(e) => onAccept(application, e.currentTarget)}>
              <Icon name="i-check" className="ic ds-desk-only" />
              <span>
                Accepter
                {first ? <span className="ds-desk-only">{` ${first}`}</span> : null}
              </span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default CandidateRow
