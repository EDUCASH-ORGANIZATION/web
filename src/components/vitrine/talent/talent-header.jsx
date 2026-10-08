import { Icon } from "@/components/design/icon"

const MONTH_YEAR = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "Africa/Porto-Novo",
})

function formatRating(rating) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating)
}

function initialsOf(displayName) {
  return displayName
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("fr-FR")
}

// En-tête du profil public (maquette V04) : identité, faits clés et trois chiffres lus en base.
export function TalentHeader({
  displayName,
  avatarUrl,
  isVerified,
  verifiedUntil,
  school,
  level,
  city,
  rating,
  reviewsCount,
  missionsDone,
}) {
  const [first, ...rest] = displayName.split(/\s+/)
  const hasRating = reviewsCount > 0 && rating > 0
  const education = [school, level].filter(Boolean).join(" · ")

  return (
    <div className="v04-hero grid-bg">
      <span className="avatar avatar--xl avatar--ring">
        {avatarUrl ? (
          <img className="rounded-full object-cover" src={avatarUrl} alt="" width={168} height={168} />
        ) : (
          <span aria-hidden="true">{initialsOf(displayName)}</span>
        )}
        {isVerified ? <Icon name="seal-citron" className="avatar__seal" /> : null}
      </span>
      <div>
        <div className="row ds-gap-3">
          {isVerified ? (
            <span className="verified verified--citron">
              <Icon name="seal" className="" />
              {verifiedUntil ? `Vérifié jusqu'en ${MONTH_YEAR.format(new Date(verifiedUntil))}` : "Profil vérifié"}
            </span>
          ) : (
            <span className="badge badge--contour">Profil non vérifié</span>
          )}
          <span className="badge badge--contour">Étudiant</span>
        </div>
        <h1 className="v04-name ds-mt-3">
          {first}
          {rest.length > 0 ? <> <span>{rest.join(" ")}</span></> : null}
        </h1>
        <div className="v04-facts">
          {education ? (
            <span><Icon name="i-graduation" />{education}</span>
          ) : null}
          {city ? (
            <span><Icon name="i-map-pin" />{city}</span>
          ) : null}
          <span>
            <Icon name="i-star" />
            {hasRating ? `${formatRating(rating)} / 5 · ${reviewsCount} avis` : "Pas encore d'avis"}
          </span>
        </div>
      </div>
      <div className="v04-kpis">
        <div className="v04-kpi v04-kpi--citron">
          <b>{missionsDone}</b>
          <span>{missionsDone > 1 ? "missions terminées" : "mission terminée"}</span>
        </div>
        <div className="v04-kpi">
          <b>{hasRating ? formatRating(rating) : "-"}</b>
          <span>note sur 5</span>
        </div>
        <div className="v04-kpi">
          <b>{reviewsCount}</b>
          <span>{reviewsCount > 1 ? "avis reçus" : "avis reçu"}</span>
        </div>
      </div>
      <Icon name="sc-burst" className="scribble v04-scribble" />
    </div>
  )
}
