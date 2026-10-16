import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { firstName, publicDisplayName } from "@/lib/vitrine/public-name"
import { clientConversationHref } from "@/lib/app/client-routes"
import { publicTalentHref } from "@/lib/app/student-routes"
import { todayInBenin } from "@/lib/vitrine/dates"

export const STUDENT_FALLBACK = "l'étudiant"

/** Vérifié : colonne `is_verified` et validité (`verified_until`) non dépassée. */
export function isVerifiedNow(student, today = todayInBenin()) {
  if (!student?.isVerified) return false
  return !student.verifiedUntil || String(student.verifiedUntil) >= today
}

const formatRating = (rating) => (Math.round(rating * 10) / 10).toFixed(1).replace(".", ",")

/**
 * Carte de l'étudiant retenu : identité publique, faits publics, Discuter et Voir le profil.
 * `title` : « Étudiant retenu » (en cours) ou « Réalisée par » (terminée). Sous 1024 px, une version compacte
 * (avatar, nom, note et missions, icône de discussion) remplace le détail : le nom mène au profil, l'icône à la
 * discussion, les deux fonctions restent.
 */
export function SelectedStudent({ title, student, missionId }) {
  if (!student) {
    return (
      <section className="card2 fup2__student" aria-label={title}>
        <div className="sec2">
          <h2 className="sec2__title">{title}</h2>
        </div>
        <p className="note2">Le profil de l&apos;étudiant n&apos;est pas disponible pour le moment.</p>
      </section>
    )
  }
  const name = publicDisplayName(student.fullName, { full: true })
  const first = firstName(student.fullName, { fallback: STUDENT_FALLBACK })
  const verified = isVerifiedNow(student)
  const sub = [student.level, student.school].filter(Boolean).join(" · ")
  const missionsLabel = `${student.missionsDone} ${student.missionsDone > 1 ? "missions" : "mission"}`
  const miniSub = [student.rating > 0 ? `${formatRating(student.rating)} / 5` : "", missionsLabel].filter(Boolean).join(" · ")
  return (
    <section className="card2 fup2__student" aria-label={title}>
      <div className="fup2__full">
        <div className="sec2">
          <h2 className="sec2__title">{title}</h2>
          {verified ? <StatusBadge label="Vérifié" tone="succes" icon="i-shield" /> : null}
        </div>
        <div className="person2">
          <Avatar name={name} src={student.avatarUrl} verified={verified} />
          <div className="fup2__who">
            <div className="person2__name">{name}</div>
            {sub ? <div className="person2__sub">{sub}</div> : null}
          </div>
        </div>
        <div className="facts2">
          {student.rating > 0 ? (
            <span>
              <Icon name="i-star" />
              <b>{formatRating(student.rating)}</b> / 5
            </span>
          ) : null}
          <span>
            <Icon name="i-briefcase" />
            {missionsLabel}
          </span>
          {student.city ? (
            <span>
              <Icon name="i-map-pin" />
              {student.city}
            </span>
          ) : null}
        </div>
        <div className="person2__acts">
          <Link className="btn btn--soft btn--sm" href={clientConversationHref(missionId, student.id)}>
            <Icon name="i-message" />
            Discuter avec {first}
          </Link>
          <Link className="link2" href={`/talents/${encodeURIComponent(student.id)}`}>
            Voir le profil
          </Link>
        </div>
      </div>
      <div className="fup2__mini">
        <Link className="person2 fup2__mini-who" href={publicTalentHref(student.id)} aria-label={`Voir le profil de ${first}`}>
          <Avatar name={name} src={student.avatarUrl} verified={verified} />
          <span className="fup2__who">
            <span className="person2__name">{name}</span>
            {miniSub ? <span className="person2__sub">{miniSub}</span> : null}
          </span>
        </Link>
        <Link className="iconbtn2" href={clientConversationHref(missionId, student.id)} aria-label={`Discuter avec ${first}`}>
          <Icon name="i-message" />
        </Link>
      </div>
    </section>
  )
}

export default SelectedStudent
