// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Select } from "@/components/design/select"
import { ChipFilter } from "@/components/app-ui/chip-filter"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { adminUserHref, adminUsersHref } from "@/lib/app/admin-routes"
import { formatAmount, formatDateFr } from "@/lib/app/format"
import { roleLabel } from "@/lib/admin-space/labels"
import { pageWindow } from "@/lib/admin-space/users"

const plural = (n, one, many) => (n > 1 ? many : one)

const VERIF_OPTIONS = [
  { value: "", label: "Toutes les vérifications" },
  { value: "verifie", label: "Vérifiés" },
  { value: "non-verifie", label: "Non vérifiés" },
  { value: "refuse", label: "Carte refusée" },
  { value: "expire", label: "Badge expiré" },
]

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "actif", label: "Actifs" },
  { value: "suspendu", label: "Suspendus" },
]

const hasFilters = (p) => Boolean(p.q || p.role || p.verif || p.statut)

/** Nom affiché : le nom du profil, sinon l'e-mail, sinon une mention neutre. */
export function displayName(row) {
  return row.name || "Profil incomplet"
}

/** Cellule « Statut » : fermeture d'abord, puis suspension, puis vérification de l'étudiant, sinon actif. */
function StatusCell({ row }) {
  if (row.closure === "closed") return <StatusBadge label="Fermé" tone="alerte" />
  if (row.closure === "pseudonymizing" || row.closure === "pseudonymized") return <StatusBadge label="Clôturé" tone="neutre" />
  if (row.isSuspended) return <StatusBadge label="Suspendu" tone="erreur" />
  if (row.verification === "Vérifié") return <StatusBadge label="Vérifié" icon="seal" />
  if (row.verification) return <span>{row.verification}</span>
  return <span>Actif</span>
}

function Header({ data }) {
  const totals = data?.totals
  return (
    <div className="head2">
      <div>
        <h1 className="head2__title">Utilisateurs</h1>
        {totals ? (
          <p className="head2__sub">
            <b>
              {totals.all} {plural(totals.all, "compte", "comptes")}
            </b>
            {` · ${totals.students} ${plural(totals.students, "étudiant", "étudiants")}, ${totals.clients} ${plural(totals.clients, "client", "clients")}, ${totals.admins} ${plural(totals.admins, "administrateur", "administrateurs")}`}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Filters({ data }) {
  const { params, totals, total } = data
  const roleOptions = [
    { value: "", label: "Tous", href: adminUsersHref({ q: params.q, statut: params.statut }), count: 0 },
    { value: "student", label: "Étudiants", href: adminUsersHref({ q: params.q, role: "student", statut: params.statut }), count: totals.students },
    { value: "client", label: "Clients", href: adminUsersHref({ q: params.q, role: "client", statut: params.statut }), count: totals.clients },
    { value: "admin", label: "Administrateurs", href: adminUsersHref({ q: params.q, role: "admin", statut: params.statut }), count: totals.admins },
  ]
  return (
    <div className="stack stack--3">
      <ChipFilter label="Filtrer par rôle" options={roleOptions} value={params.verif ? "student" : params.role} />
      <form className="a2-filters" method="get" action="/admin/users" role="search" aria-label="Rechercher un utilisateur">
        {params.role && !params.verif ? <input type="hidden" name="role" value={params.role} /> : null}
        <label className="search2">
          <Icon name="i-search" />
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="Nom, e-mail ou téléphone"
            aria-label="Rechercher par nom, e-mail ou téléphone"
            maxLength={80}
          />
        </label>
        <Select
          variant="chip"
          name="verif"
          defaultValue={params.verif}
          options={VERIF_OPTIONS}
          placeholder="Vérification"
          aria-label="Vérification"
        />
        <Select
          variant="chip"
          name="statut"
          defaultValue={params.statut}
          options={STATUS_OPTIONS}
          placeholder="Statut"
          aria-label="Statut du compte"
        />
        <button type="submit" className="btn btn--secondary btn--sm">
          Rechercher
        </button>
        <span className="a2-filters__count" role="status">
          {total} {plural(total, "résultat", "résultats")}
        </span>
      </form>
    </div>
  )
}

function Pager({ data }) {
  const { params, pageCount } = data
  if (pageCount <= 1) return null
  const href = (page) => adminUsersHref({ ...params, page })
  return (
    <nav className="a2-03-pages" aria-label="Pagination des utilisateurs">
      {params.page > 1 ? (
        <Link className="page-btn page-btn--nav" href={href(params.page - 1)} aria-label="Page précédente">
          <Icon name="i-chevron-left" />
        </Link>
      ) : null}
      {pageWindow(params.page, pageCount).map((entry, i) =>
        entry === "..." ? (
          <span key={`gap-${i}`} className="caption" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={entry}
            className={entry === params.page ? "page-btn is-active" : "page-btn"}
            href={href(entry)}
            aria-label={`Page ${entry}`}
            aria-current={entry === params.page ? "page" : undefined}
          >
            {entry}
          </Link>
        ),
      )}
      {params.page < pageCount ? (
        <Link className="page-btn page-btn--nav" href={href(params.page + 1)} aria-label="Page suivante">
          <Icon name="i-chevron-right" />
        </Link>
      ) : null}
    </nav>
  )
}

function Empty({ data }) {
  const { params, totals } = data
  if (hasFilters(params)) {
    return (
      <EmptyState
        icon="i-search"
        title="Aucun utilisateur trouvé"
        text={params.q ? `Aucun compte ne correspond à « ${params.q} » avec ces filtres. Vérifiez l'orthographe ou retirez un filtre.` : "Aucun compte ne correspond à ces filtres."}
        action={{ href: adminUsersHref(), label: "Effacer les filtres" }}
      />
    )
  }
  return <EmptyState icon="i-users" title="Aucun compte pour le moment." text={totals.all === 0 ? undefined : "La liste est vide."} />
}

function Table({ rows }) {
  return (
    <div className="ds-table-wrap">
      <table className="ds-table a2-tlist" aria-label="Liste des utilisateurs">
        <thead>
          <tr>
            <th scope="col">Utilisateur</th>
            <th scope="col">Rôle</th>
            <th scope="col">Statut</th>
            <th scope="col">Ville</th>
            <th scope="col">Solde disponible</th>
            <th scope="col">Missions</th>
            <th scope="col">Inscription</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className={row.isSuspended ? "a2-03-row a2-03-row--off" : "a2-03-row"}>
              <td data-label="Utilisateur">
                <div className="a2-03-who">
                  <div>
                    <Link className="a2-03-who__name a2-03-link" href={adminUserHref(row.userId)}>
                      {displayName(row)}
                      {row.isSelf ? " (vous)" : ""}
                    </Link>
                    {row.email ? <div className="a2-03-who__sub">{row.email}</div> : null}
                  </div>
                </div>
              </td>
              <td data-label="Rôle">{roleLabel(row.role)}</td>
              <td data-label="Statut">
                <StatusCell row={row} />
              </td>
              <td data-label="Ville">{row.city || "-"}</td>
              <td data-label="Solde disponible">{row.balance === null ? "-" : formatAmount(row.balance)}</td>
              <td data-label="Missions">{row.missions === null ? "-" : row.missions}</td>
              <td data-label="Inscription">{row.createdAt ? formatDateFr(row.createdAt) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Liste des utilisateurs (AD03). Vue pure : `data` est la réponse de `listAdminUsers`, `error` son message d'erreur.
 * Une ligne ouvre la fiche ; aucune action de suspension dans la liste.
 */
export function UsersView({ data, error }) {
  if (error || !data) {
    return (
      <div className="a2-03">
        <Header data={null} />
        <ErrorState titleAs="h2" title="Les utilisateurs n'ont pas pu être chargés" text={error || undefined} />
      </div>
    )
  }
  return (
    <div className="a2-03">
      <Header data={data} />
      <Filters data={data} />
      {data.pageClamped ? (
        <div className="a2-note" role="status">
          <Icon name="i-info" className="ic" />
          <span>
            La page {data.requestedPage} n&apos;existe pas. Voici la dernière page ({data.params.page}).
          </span>
        </div>
      ) : null}
      {data.rows.length > 0 ? <Table rows={data.rows} /> : <Empty data={data} />}
      <Pager data={data} />
    </div>
  )
}

export default UsersView
