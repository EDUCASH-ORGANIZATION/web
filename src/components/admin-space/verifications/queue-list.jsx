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

/** Sous-titre d'une ligne : établissement puis nature du dossier. */
export function rowSubtitle(row) {
  const school = row.school || "Établissement non renseigné"
  const nature = KIND_SUB[row.kind] ?? TAB_SUB[row.tab] ?? ""
  return nature ? `${school} · ${nature}` : school
}

/**
 * Liste des dossiers de l'onglet, plus anciens d'abord. Aucune carte ni adresse e-mail : nom, établissement,
 * nature et ancienneté seulement. La ligne ouverte porte `aria-current`.
 */
export function QueueList({ rows, openId, onglet, q, ecole, page }) {
  return (
    <nav aria-label="Dossiers à traiter" className="a2-02-list" data-queue-scope>
      {rows.map((row) => (
        <Link
          key={row.userId}
          className="a2-02-row"
          href={adminVerificationsHref({ onglet, id: row.userId, q, ecole, page })}
          aria-current={row.userId === openId ? "true" : undefined}
        >
          <span className="row row--nowrap">
            <span className="lrow__ic">
              <Icon name="i-id-card" />
            </span>
            <span className="a2-02-row__text">
              <span className="a2-02-row__name">{row.name || "Étudiant sans nom"}</span>
              <span className="a2-02-row__sub">{rowSubtitle(row)}</span>
            </span>
          </span>
          {row.overdue48h ? (
            <span className="badge badge--alerte badge--sm">+48 h</span>
          ) : (
            <span className="a2-02-row__age">{row.age}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}

export default QueueList
