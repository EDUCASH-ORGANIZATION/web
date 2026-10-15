// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { adminVerificationsHref } from "@/lib/app/admin-routes"

const TAB_SUB = {
  refuses: "Carte refusée",
  verifies: "Badge valide",
  expires: "Badge expiré",
  incomplets: "Carte non envoyée",
}

const KIND_SUB = {
  renouvellement: "renouvellement du badge",
  premiere: "première demande",
}

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** « 5 oct. » à partir d'un jour "AAAA-MM-JJ" ; vide si le jour est illisible. */
export function shortDay(day) {
  if (typeof day !== "string" || !DAY_ONLY.test(day)) return ""
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(date)
}

/** « 12 mars 2027 » à partir d'un jour "AAAA-MM-JJ" ; vide si le jour est illisible. */
export function longDay(day) {
  if (typeof day !== "string" || !DAY_ONLY.test(day)) return ""
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)
}

/** « soumis aujourd'hui », « soumis hier » ou « soumis le 5 oct. » ; vide sans jour de dépôt lisible. */
export function submittedLabel(submittedOn, today) {
  const day = shortDay(submittedOn)
  if (!day) return ""
  if (submittedOn === today) return "soumis aujourd'hui"
  if (typeof today === "string" && DAY_ONLY.test(today)) {
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    if (submittedOn === yesterday) return "soumis hier"
  }
  return `soumis le ${day}`
}

/** Échéance du badge : « jusqu'au 12 mars 2027 » (vérifiés), « expiré le 30 sept. » (expirés) ; vide sans jour lisible. */
function untilLabel(row) {
  if (row.tab === "verifies") {
    const day = longDay(row.verifiedUntil)
    return day ? `jusqu'au ${day}` : ""
  }
  if (row.tab === "expires") {
    const day = shortDay(row.verifiedUntil)
    return day ? `expiré le ${day}` : ""
  }
  return ""
}

/**
 * Sous-titre d'une ligne : établissement puis nature du dossier. Onglet « À examiner » : jour de dépôt quand il est
 * connu (« soumis le 5 oct. »), « renouvellement du badge » pour un renouvellement.
 */
export function rowSubtitle(row, today) {
  const school = row.school || "Établissement non renseigné"
  const submitted = row.tab === "a-examiner" && row.kind !== "renouvellement" ? submittedLabel(row.submittedOn, today) : ""
  const nature = submitted || untilLabel(row) || (KIND_SUB[row.kind] ?? TAB_SUB[row.tab] ?? "")
  return nature ? `${school} · ${nature}` : school
}

/** Pastille d'ancienneté d'une ligne « À examiner » : « 3 j · +48 h » (erreur), « Hier », « Auj. » ou « N j » (contour). */
function AgeBadge({ row }) {
  if (row.overdue48h) {
    const text = /^\d+ j$/.test(row.age) ? `${row.age} · +48 h` : "+48 h"
    return <span className="badge badge--erreur badge--sm">{text}</span>
  }
  if (!row.age) return null
  const text = row.age === "Aujourd'hui" ? "Auj." : row.age
  return <span className="badge badge--contour badge--sm">{text}</span>
}

/** Pastille des onglets autres que « À examiner » : état du dossier, sans donnée privée. */
function StateBadge({ tab }) {
  if (tab === "incomplets") {
    return (
      <span className="badge badge--neutre badge--sm">
        <Icon name="i-id-card" />
        Non vérifié
      </span>
    )
  }
  if (tab === "refuses") {
    return (
      <span className="badge badge--erreur badge--sm">
        <Icon name="i-x" />
        Carte refusée
      </span>
    )
  }
  if (tab === "verifies") {
    return (
      <span className="verified verified--sm">
        <Icon name="seal-citron" className="" />
        Vérifié
      </span>
    )
  }
  if (tab === "expires") {
    return (
      <span className="badge badge--encre badge--sm">
        <Icon name="i-history" />
        Badge expiré
      </span>
    )
  }
  return null
}

/**
 * Liste des dossiers de l'onglet, plus anciens d'abord. Aucune carte ni adresse e-mail : nom, établissement,
 * nature et ancienneté seulement. La ligne ouverte porte `aria-current`.
 */
export function QueueList({ rows, openId, onglet, q, ecole, delai, page, today }) {
  return (
    <nav aria-label="Dossiers à traiter" className="a2-02-list" data-queue-scope>
      {rows.map((row) => (
        <Link
          key={row.userId}
          className="a2-02-row"
          href={adminVerificationsHref({ onglet, id: row.userId, q, ecole, delai, page })}
          aria-current={row.userId === openId ? "true" : undefined}
        >
          <span className="row row--nowrap">
            <span className="lrow__ic">
              <Icon name="i-id-card" />
            </span>
            <span className="a2-02-row__text">
              <span className="a2-02-row__name">{row.name || "Étudiant sans nom"}</span>
              <span className="a2-02-row__sub">{rowSubtitle(row, today)}</span>
            </span>
          </span>
          {row.tab === "a-examiner" ? <AgeBadge row={row} /> : <StateBadge tab={row.tab} />}
        </Link>
      ))}
    </nav>
  )
}

export default QueueList
