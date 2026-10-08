import Link from "next/link"
import { publicDisplayName } from "@/lib/vitrine/public-name"
import { Icon } from "@/components/design/icon"

const FALLBACK_NAME = "Client EduCash"

function initialsOf(name) {
  const parts = name.replace(/\./g, "").split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "C"
  const first = parts[0].charAt(0)
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ""
  return (first + last).toLocaleUpperCase("fr-FR")
}

/**
 * Carte « À propos du client ». Le nom est abrégé (prénom et initiale)
 * pour un visiteur, complet pour un utilisateur connecté (Q7).
 * @param {{ profile: { full_name?: string|null, city?: string|null, rating?: number|null, missions_done?: number|null }|null, viewerLoggedIn: boolean }} props
 */
export function ClientCard({ profile, viewerLoggedIn }) {
  const hasName = Boolean(profile?.full_name?.trim())
  const name = hasName
    ? publicDisplayName(profile.full_name, { full: viewerLoggedIn })
    : FALLBACK_NAME
  const rating = Number(profile?.rating) || 0
  const done = Number(profile?.missions_done) || 0

  return (
    <div className="card">
      <div className="card__head">
        <h2 className="card__title">À propos du client</h2>
        <Link className="link body-s" href="/contact?sujet=signalement">
          <Icon name="i-flag" className="ic ic--16" />Signaler
        </Link>
      </div>
      <div className="row row--nowrap ds-gap-4">
        <span className="avatar avatar--lg avatar--citron" aria-hidden="true">{initialsOf(name)}</span>
        <div className="grow">
          <div className="h4">{name}</div>
          {profile?.city ? <div className="caption">{profile.city}</div> : null}
        </div>
        {rating > 0 || done > 0 ? (
          <div className="stack stack--2 ds-items-end">
            {rating > 0 ? (
              <span className="rating">
                {rating.toFixed(1).replace(".", ",")}<small>/ 5</small>
              </span>
            ) : null}
            {done > 0 ? (
              <span className="caption">
                {done} mission{done > 1 ? "s" : ""} terminée{done > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
