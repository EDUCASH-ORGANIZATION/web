// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { Avatar } from "@/components/app-ui/avatar"
import { Stat, StatGroup } from "@/components/app-ui/stats"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { formatDateFr } from "@/lib/app/format"
import { publicTalentHref, studentProfileEditHref, studentWalletHref } from "@/lib/app/student-routes"
import { missionTypeLabel } from "@/lib/constants/missions"
import { missingProfileItems, parseAvailability } from "@/lib/student-space/profile-rules"

const HELP_HREF = "/aide"
const UNAVAILABLE = <span className="e2-muted">Indisponible</span>
const BENIN_TZ = "Africa/Porto-Novo"

/** Mois et année en français, ex. « avril 2026 ». Chaîne vide si la date est absente ou invalide. */
export function monthYear(iso) {
  const date = new Date(iso ?? Number.NaN)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: BENIN_TZ }).format(date)
}

/** Note sur 5 avec une décimale et la virgule française : « 4,8 ». */
export function ratingValue(rating) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(rating) || 0)
}

function plural(n, one, many) {
  return n > 1 ? many : one
}

// Ton du badge et phrase d'état de chaque statut de vérification. Aucun délai d'examen n'est annoncé.
const VERIFICATION_TONE = {
  verified: "succes",
  expiring: "alerte",
  expired: "erreur",
  rejected: "erreur",
  pending: "bleu",
  not_submitted: "neutre",
}

function verificationText(verification) {
  const until = verification.verifiedUntil ? formatDateFr(verification.verifiedUntil) : ""
  switch (verification.key) {
    case "verified":
      return until ? `Votre badge est valable jusqu'au ${until}.` : "Votre compte est vérifié."
    case "expiring":
      return until ? `Votre badge expire le ${until}. Renouvelez-le pour rester vérifié.` : "Votre badge arrive à échéance. Renouvelez-le pour rester vérifié."
    case "expired":
      return "Votre badge a expiré. Renouvelez-le pour postuler aux missions."
    case "rejected":
      return "Votre carte a été refusée. Renvoyez-la pour postuler aux missions."
    case "pending":
      return "Votre carte est en cours d'examen. Vous pouvez déjà postuler."
    default:
      return "Envoyez votre carte étudiante pour postuler aux missions."
  }
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

function Identity({ summary }) {
  const { identity, verification } = summary
  const since = monthYear(identity.memberSince)
  const studies = [identity.school, identity.level].filter(Boolean).join(" · ")
  const verified = verification.key === "verified" || verification.key === "expiring"
  return (
    <header className="e2-10-id">
      <span className="e2-10-avatar">
        <Avatar name={identity.fullName || "Étudiant"} src={identity.avatarUrl ?? undefined} />
        {verified ? <Icon name="seal" className="seal" /> : null}
      </span>
      <div className="e2-10-id__main">
        <PageHead date="Mon profil · ce que voient les clients" title={identity.fullName || "Mon profil"} />
        <div className="e2-10-id__meta">
          {verified ? <StatusBadge label="Vérifié" tone="succes" icon="i-check" /> : null}
          {identity.city ? (
            <span>
              <Icon name="i-map-pin" />
              {identity.city}
            </span>
          ) : null}
          {studies ? (
            <span>
              <Icon name="i-graduation" />
              {studies}
            </span>
          ) : null}
          {since ? (
            <span>
              <Icon name="i-calendar" />
              {`Membre depuis ${since}`}
            </span>
          ) : null}
        </div>
      </div>
      <div className="e2-10-id__actions">
        <Link className="e2-link" href={publicTalentHref(identity.userId)}>
          <Icon name="i-external" />
          Voir mon profil public
        </Link>
        <Link className="btn btn--dark" href={studentProfileEditHref()}>
          <Icon name="i-pencil" />
          Modifier
        </Link>
      </div>
    </header>
  )
}

function Figures({ stats }) {
  const hasRating = stats.rating > 0 && stats.reviewsCount !== 0
  return (
    <StatGroup label="Vos chiffres">
      <Stat
        label="Note"
        value={hasRating ? `${ratingValue(stats.rating)} / 5` : "Pas de note"}
        sub={
          stats.reviewsCount === null
            ? ""
            : stats.reviewsCount > 0
              ? `${stats.reviewsCount} ${plural(stats.reviewsCount, "avis reçu", "avis reçus")}`
              : "aucun avis reçu"
        }
      />
      <Stat label="Missions terminées" value={stats.done ?? UNAVAILABLE} sub={stats.done === null ? "lecture impossible" : "menées à terme"} />
      {stats.totalEarned === null ? (
        <Stat label="Total gagné" value={UNAVAILABLE} sub="lecture impossible" />
      ) : (
        <Stat
          label="Total gagné"
          amount={stats.totalEarned}
          sub={
            <>
              votre part nette · <Link className="e2-link" href={studentWalletHref()}>Voir le portefeuille</Link>
            </>
          }
        />
      )}
    </StatGroup>
  )
}

function Section({ title, count, aside, children }) {
  return (
    <section className="e2-sec" aria-label={title}>
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">
          {title}
          {count !== undefined && count !== null ? <span>{count}</span> : null}
        </h2>
        {aside}
      </div>
      <div className="e2-sec__body">{children}</div>
    </section>
  )
}

function EditLink({ children }) {
  return (
    <Link className="e2-link" href={studentProfileEditHref()}>
      {children}
    </Link>
  )
}

function Todo({ missing }) {
  return (
    <div className="e2-note e2-note--blanc">
      <Icon name="i-info" />
      <div className="e2-note__body">
        <div className="e2-note__title">Complétez votre profil</div>
        <div className="e2-note__text">{`Il manque ${missing.join(", ")}. Un profil complet rassure les clients.`}</div>
        <div className="e2-note__actions">
          <EditLink>Compléter mon profil</EditLink>
        </div>
      </div>
    </div>
  )
}

function Reviews({ reviews, total }) {
  return (
    <Section title="Avis reçus" count={total ?? reviews.length}>
      {reviews.length === 0 ? (
        <EmptyState
          compact
          icon="i-star"
          title="Pas encore d'avis"
          text="Les clients vous notent après chaque mission terminée. Leurs avis apparaîtront ici."
        />
      ) : (
        <>
          {reviews.map((review) => (
            <div className="e2-10-review" key={review.id}>
              <div className="e2-who">
                <Avatar name={review.authorFirstName} />
                <div className="e2-10-who">
                  <div className="e2-who__name">{review.authorFirstName}</div>
                  <div className="e2-who__sub">
                    {[review.missionTitle, monthYear(review.createdAt)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <StarsDisplay rating={review.rating} />
              </div>
              {review.comment ? <p>{review.comment}</p> : null}
            </div>
          ))}
          {total !== null && total > reviews.length ? (
            <p className="caption e2-muted">{`Les ${reviews.length} avis les plus récents sont affichés.`}</p>
          ) : null}
        </>
      )}
    </Section>
  )
}

function VerificationCard({ verification }) {
  return (
    <Section title="Vérification">
      <div>
        <StatusBadge label={verification.label} tone={VERIFICATION_TONE[verification.key] ?? "neutre"} />
      </div>
      <p className="e2-text">{verificationText(verification)}</p>
      {verification.action ? (
        <Link className="e2-link" href={verification.action.href}>
          {verification.action.label}
        </Link>
      ) : null}
    </Section>
  )
}

/**
 * Profil de l'étudiant (E10, consultation). Vue sans accès aux données : `summary` vient de
 * `getStudentProfileSummary` (identité publique, statut de vérification calculé, chiffres, avis reçus),
 * `logoutAction` est la server action de déconnexion. Un chiffre `null` s'affiche « Indisponible » (jamais un faux 0).
 * @param {{
 *   summary?: import("@/lib/actions/student-profile.actions").StudentProfileSummary,
 *   error?: string,
 *   logoutAction?: () => Promise<void>,
 * }} props
 */
export function StudentProfileView({ summary, error, logoutAction }) {
  if (error || !summary) {
    return (
      <div className="page2">
        <ErrorState
          titleAs="h1"
          title="Impossible de charger votre profil"
          text="Le chargement a échoué. Vos données et votre argent ne sont pas touchés."
        />
      </div>
    )
  }
  const { identity, stats, reviews } = summary
  const missing = missingProfileItems(identity)
  const availability = parseAvailability(identity.availability)
  const days = [...availability.presets, ...(availability.other ? [availability.other] : [])]
  return (
    <div className="page2">
      <Identity summary={summary} />
      {missing.length > 0 ? <Todo missing={missing} /> : null}
      <Figures stats={stats} />
      <div className="e2-cols">
        <div className="e2-stack">
          <Section title="À propos" aside={identity.bio ? <EditLink>Modifier</EditLink> : null}>
            {identity.bio ? (
              <p className="e2-text e2-10-bio">{identity.bio}</p>
            ) : (
              <p className="e2-text e2-muted">Aucune présentation pour le moment.</p>
            )}
          </Section>
          <Section title="Compétences" count={identity.skills.length}>
            {identity.skills.length > 0 ? (
              <div className="chips">
                {identity.skills.map((skill) => (
                  <span className="tag tag--neutre" key={skill}>
                    {missionTypeLabel(skill)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="e2-text e2-muted">Aucune compétence renseignée.</p>
            )}
          </Section>
          <Section title="Disponibilités" aside={<span className="caption e2-muted">Indicatif</span>}>
            {days.length > 0 ? (
              <div className="chips">
                {days.map((day) => (
                  <span className="tag tag--neutre" key={day}>
                    {day}
                  </span>
                ))}
              </div>
            ) : (
              <p className="e2-text e2-muted">Aucune disponibilité renseignée.</p>
            )}
          </Section>
          <Reviews reviews={reviews} total={stats.reviewsCount} />
        </div>
        <div className="e2-stack">
          <VerificationCard verification={summary.verification} />
          <Section title="Compte">
            <nav className="e2-10-links" aria-label="Compte">
              <Link href={HELP_HREF}>
                <Icon name="i-help" />
                Aide
                <Icon name="i-chevron-right" />
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="e2-10-out">
                  <Icon name="i-logout" />
                  Se déconnecter
                </button>
              </form>
            </nav>
          </Section>
        </div>
      </div>
    </div>
  )
}

export default StudentProfileView
