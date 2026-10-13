import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { Avatar } from "@/components/app-ui/avatar"
import { Stat } from "@/components/app-ui/stats"
import { SectionCard } from "@/components/app-ui/section-card"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { formatBeninPhone } from "@/lib/utils/phone"

const EDIT_HREF = "/client/profile/edit"
const UNAVAILABLE = <span className="profile2__na">Indisponible</span>
const NOT_SET = "Non renseigné"
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

/**
 * Éléments du profil encore à renseigner (structure, téléphone, logo). Liste vide : profil complet.
 * @param {{ companyName?: string|null, phone?: string|null, avatarUrl?: string|null }} identity
 * @returns {string[]}
 */
export function missingProfileItems(identity) {
  const missing = []
  if (!identity?.companyName) missing.push("le nom de votre structure")
  if (!identity?.phone) missing.push("votre téléphone")
  if (!identity?.avatarUrl) missing.push("un logo ou une photo")
  return missing
}

function plural(n, one, many) {
  return n > 1 ? many : one
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

function activitySub(stats) {
  if (stats.active === null || stats.cancelled === null) return ""
  return `${stats.active} ${plural(stats.active, "active", "actives")} · ${stats.cancelled} ${plural(stats.cancelled, "annulée", "annulées")}`
}

function Figures({ stats }) {
  const hasRating = stats.rating > 0
  return (
    <section className="stats2 stats2--4" aria-label="Vos chiffres">
      <Stat label="Missions publiées" value={stats.published ?? UNAVAILABLE} sub={activitySub(stats)} />
      <Stat label="Terminées" value={stats.done ?? UNAVAILABLE} sub="menées à terme" />
      {stats.totalSpent === null ? (
        <Stat label="Total dépensé" value={UNAVAILABLE} sub="lecture impossible" />
      ) : (
        <Stat label="Total dépensé" amount={stats.totalSpent} sub="commission comprise" />
      )}
      <Stat
        label="Note des étudiants"
        value={hasRating ? `${ratingValue(stats.rating)} / 5` : "Pas de note"}
        sub={
          stats.reviewsCount === null
            ? ""
            : stats.reviewsCount > 0
              ? `${stats.reviewsCount} ${plural(stats.reviewsCount, "avis reçu", "avis reçus")}`
              : "aucun avis reçu"
        }
      />
    </section>
  )
}

function Identity({ identity, stats }) {
  const hasRating = stats.rating > 0 && stats.reviewsCount !== 0
  const since = monthYear(identity.memberSince)
  return (
    <section className="card2" aria-label="Identité">
      <div className="me2">
        <Avatar name={identity.fullName} src={identity.avatarUrl ?? undefined} />
        <div className="me2__text">
          <h2 className="me2__name">{identity.fullName || "Votre nom"}</h2>
          <div className="me2__sub">
            {identity.companyName ? `${identity.companyName} · affichée sur vos missions` : "Structure non renseignée"}
          </div>
        </div>
        <Link className="link2 me2__edit" href={EDIT_HREF}>
          <Icon name="i-pencil" />
          Modifier le profil
        </Link>
      </div>
      <div className="meta2">
        {identity.city ? (
          <span>
            <Icon name="i-map-pin" />
            {identity.city}
          </span>
        ) : null}
        {since ? (
          <span>
            <Icon name="i-calendar" />
            Membre depuis {since}
          </span>
        ) : null}
        {hasRating ? (
          <span>
            <Icon name="i-star" />
            {ratingValue(stats.rating)} / 5
            {stats.reviewsCount ? ` · ${stats.reviewsCount} avis d'étudiants` : ""}
          </span>
        ) : null}
      </div>
    </section>
  )
}

function Todo({ missing }) {
  return (
    <section className="card2" aria-label="À faire">
      <span className="eyebrow2">À faire</span>
      <h2 className="sec2__title">Complétez votre profil</h2>
      <p className="prof2__p">
        Il manque {missing.join(", ")}. Les étudiants répondent plus vite à un client identifié.
      </p>
      <div className="actions2">
        <Link className="btn btn--soft btn--sm" href={EDIT_HREF}>
          Compléter mon profil
        </Link>
      </div>
    </section>
  )
}

function Reviews({ reviews, total }) {
  return (
    <SectionCard title="Avis des étudiants" count={total ?? reviews.length}>
      {reviews.length === 0 ? (
        <EmptyState
          compact
          icon="i-star"
          title="Pas encore d'avis"
          text="Les étudiants vous notent après chaque mission terminée. Leurs avis apparaîtront ici."
        />
      ) : (
        <>
          {reviews.map((review) => (
            <div className="review2x" key={review.id}>
              <div className="review2x__top">
                <div className="person2">
                  <Avatar name={review.authorFirstName} />
                  <div className="person2__who">
                    <div className="person2__name">{review.authorFirstName}</div>
                    {review.missionTitle ? <div className="person2__sub">{review.missionTitle}</div> : null}
                  </div>
                </div>
                <StarsDisplay rating={review.rating} />
              </div>
              {review.comment ? <p className="prof2__p prof2__p--encre profile2__comment">{review.comment}</p> : null}
              <span className="caption muted">{monthYear(review.createdAt)}</span>
            </div>
          ))}
          {total !== null && total > reviews.length ? (
            <p className="note2">Les {reviews.length} avis les plus récents sont affichés.</p>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}

function Details({ identity }) {
  const phone = identity.phone ? formatBeninPhone(identity.phone) : ""
  const rows = [
    ["Structure", identity.companyName],
    ["Contact", identity.fullName],
    ["Ville", identity.city],
    ["Téléphone", phone],
  ]
  return (
    <SectionCard title="Informations" more={{ label: "Modifier", href: EDIT_HREF }}>
      <div className="lines2">
        {rows.map(([label, value]) => (
          <div className="lines2__row" key={label}>
            <span>{label}</span>
            <b>{value || NOT_SET}</b>
          </div>
        ))}
      </div>
      <p className="note2">
        <Icon name="i-lock" />
        <span>Votre téléphone n&apos;est jamais affiché publiquement.</span>
      </p>
    </SectionCard>
  )
}

/**
 * Profil client (C17, consultation). Vue sans accès aux données : `summary` vient de `getClientProfileSummary`
 * (identité publique, chiffres, avis reçus), `logoutAction` est la server action de déconnexion.
 * Un chiffre `null` s'affiche « Indisponible » (jamais un faux 0).
 * @param {{
 *   summary?: import("@/lib/actions/profile.actions").ClientProfileSummary,
 *   error?: string,
 *   logoutAction?: () => Promise<void>,
 * }} props
 */
export function ClientProfileView({ summary, error, logoutAction }) {
  if (error || !summary) {
    return (
      <div className="page2">
        <ErrorState titleAs="h1" title="Impossible de charger votre profil" />
      </div>
    )
  }
  const { identity, stats, reviews } = summary
  const missing = missingProfileItems(identity)
  return (
    <div className="profile2">
      <PageHead
        date="L'identité affichée sur vos missions, vos chiffres et ce que disent les étudiants"
        title="Mon profil"
      />
      <div className="split2">
        <div className="col2">
          <Identity identity={identity} stats={stats} />
          {missing.length > 0 ? <Todo missing={missing} /> : null}
          <Figures stats={stats} />
          <Reviews reviews={reviews} total={stats.reviewsCount} />
        </div>
        <div className="col2">
          <Details identity={identity} />
          <section className="card2" aria-label="Compte">
            <div className="sec2">
              <h2 className="sec2__title">Compte</h2>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="link2 link2--muted profile2__out">
                <Icon name="i-logout" />
                Se déconnecter
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

export default ClientProfileView
