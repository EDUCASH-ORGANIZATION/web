// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Select } from "@/components/design/select"
import { TabsNav } from "@/components/app-ui/tabs-nav"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { formatAmount, formatShortDate } from "@/lib/app/format"
import { missionStatusView } from "@/lib/app/mission-status"
import { adminMissionHref, adminMissionsHref, adminUserHref } from "@/lib/app/admin-routes"
import { CITIES, MISSION_TYPES, MISSION_TYPE_LABELS, missionTypeLabel } from "@/lib/constants/missions"
import { DEFAULT_MISSION_TAB, MISSION_TABS, MISSION_TAB_LABELS, MISSIONS_SEARCH_MAX } from "@/lib/admin-space/missions"

const plural = (n, one, many) => (n > 1 ? many : one)
const NO_NAME = "Compte sans nom"

/** Sous-titre : nombre de missions du filtre courant et de celles dont la fin est à confirmer. */
export function missionsSubtitle(total, toConfirm) {
  const strong = total === 0 ? "Aucune mission" : `${total} ${plural(total, "mission", "missions")}`
  const rest = toConfirm > 0 ? `${toConfirm} ${plural(toConfirm, "fin à confirmer", "fins à confirmer")}` : ""
  return { strong, rest }
}

function Header({ data }) {
  const sub = data ? missionsSubtitle(data.total, data.counts["a-confirmer"]) : null
  return (
    <div className="head2">
      <div>
        <h1 className="head2__title">Missions</h1>
        {sub ? (
          <p className="head2__sub">
            <b>{sub.strong}</b>
            {sub.rest ? ` · ${sub.rest}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Filters({ data }) {
  const { statut, q, ville, type } = data
  const cities = [{ value: "", label: "Toutes les villes" }, ...CITIES.map((city) => ({ value: city, label: city }))]
  const types = [{ value: "", label: "Tous les types" }, ...MISSION_TYPES.map((t) => ({ value: t, label: MISSION_TYPE_LABELS[t] ?? missionTypeLabel(t) }))]
  return (
    <form className="a2-filters" method="get" action="/admin/missions" role="search" aria-label="Rechercher une mission">
      {statut !== DEFAULT_MISSION_TAB ? <input type="hidden" name="statut" value={statut} /> : null}
      <label className="search2">
        <Icon name="i-search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Titre de la mission"
          aria-label="Rechercher une mission par titre"
          maxLength={MISSIONS_SEARCH_MAX}
        />
      </label>
      <Select variant="chip" name="ville" icon="i-map-pin" defaultValue={ville} options={cities} placeholder="Ville" aria-label="Ville" />
      <Select variant="chip" name="type" icon="i-briefcase" defaultValue={type} options={types} placeholder="Type" aria-label="Type de mission" />
      <button type="submit" className="btn btn--secondary btn--sm">
        Rechercher
      </button>
    </form>
  )
}

function PartyCell({ id, name, fallback }) {
  if (!id) return <span className="a2-06-sub">{fallback}</span>
  return (
    <Link className="link" href={adminUserHref(id)}>
      {name || NO_NAME}
    </Link>
  )
}

function Row({ row, today }) {
  const view = missionStatusView({ status: row.status, deadline: row.deadline }, today)
  return (
    <tr className="a2-06-row">
      <td data-label="Mission">
        <Link className="a2-06-title link" href={adminMissionHref(row.id)}>
          {row.title || "Mission sans titre"}
        </Link>
        <div className="a2-06-sub">{missionTypeLabel(row.type)}</div>
      </td>
      <td data-label="Client">
        <PartyCell id={row.clientId} name={row.clientName} fallback="Inconnu" />
      </td>
      <td data-label="Étudiant">
        <PartyCell id={row.studentId} name={row.studentName} fallback="Non retenu" />
      </td>
      <td className="t-num" data-label="Budget">
        {formatAmount(row.budget)}
      </td>
      <td data-label="Ville">{row.city ?? "Non précisée"}</td>
      <td data-label="Statut">
        <StatusBadge label={view.label} tone={view.tone} />
        {row.awaitingConfirm ? <div className="a2-06-sub">Fin à confirmer</div> : null}
      </td>
      <td data-label="Échéance">{row.deadline ? formatShortDate(row.deadline) : "Sans échéance"}</td>
    </tr>
  )
}

function Empty({ data }) {
  if (data.q || data.ville || data.type) {
    return <EmptyState compact icon="i-search" title="Aucune mission ne correspond à cette recherche." />
  }
  if (data.statut !== DEFAULT_MISSION_TAB) return <EmptyState compact title="Aucune mission dans cet onglet." />
  return <EmptyState icon="i-briefcase" title="Aucune mission pour le moment." text="Les missions publiées par les clients apparaîtront ici." />
}

function Pager({ data }) {
  const { statut, q, ville, type, page, pageCount } = data
  if (pageCount <= 1) return null
  const href = (target) => adminMissionsHref({ statut: statut === DEFAULT_MISSION_TAB ? undefined : statut, q, ville, type, page: target })
  return (
    <nav className="row row--between" aria-label="Pagination des missions">
      {page > 1 ? (
        <Link className="btn btn--secondary btn--sm" href={href(page - 1)}>
          <Icon name="i-chevron-left" />
          Précédent
        </Link>
      ) : (
        <span />
      )}
      <span className="caption">
        Page {page} sur {pageCount}
      </span>
      {page < pageCount ? (
        <Link className="btn btn--secondary btn--sm" href={href(page + 1)}>
          Suivant
          <Icon name="i-chevron-right" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}

/**
 * Liste des missions (AD06), lecture seule. Vue pure : le serveur fournit toutes les données.
 * `data` est la réponse de `listAdminMissions` ; `error` vaut son message quand la lecture a échoué.
 */
export function MissionsView({ data, error }) {
  if (error || !data) {
    return (
      <div className="a2-06">
        <Header data={null} />
        <ErrorState titleAs="h2" title="Les missions n'ont pas pu être chargées" text={error || undefined} />
      </div>
    )
  }

  const { statut, q, ville, type, counts, rows, today } = data
  const tabs = MISSION_TABS.map((key) => ({
    key,
    label: MISSION_TAB_LABELS[key],
    href: adminMissionsHref({ statut: key === DEFAULT_MISSION_TAB ? undefined : key, q, ville, type }),
    count: counts[key],
  }))

  return (
    <div className="a2-06">
      <Header data={data} />
      <TabsNav label="Missions par statut" items={tabs} activeKey={statut} />
      <Filters data={data} />
      {rows.length > 0 ? (
        <div className="ds-table-wrap">
          <table className="ds-table a2-tlist">
            <caption className="sr-only">Liste des missions</caption>
            <thead>
              <tr>
                <th scope="col">Mission</th>
                <th scope="col">Client</th>
                <th scope="col">Étudiant</th>
                <th scope="col" className="t-num">
                  Budget
                </th>
                <th scope="col">Ville</th>
                <th scope="col">Statut</th>
                <th scope="col">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.id} row={row} today={today} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty data={data} />
      )}
      <Pager data={data} />
    </div>
  )
}

export default MissionsView
