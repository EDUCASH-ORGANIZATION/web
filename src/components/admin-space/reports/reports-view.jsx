// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { TabsNav } from "@/components/app-ui/tabs-nav"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Stat, StatGroup } from "@/components/app-ui/stats"
import { Pager } from "@/components/admin-space/finance/pager"
import { formatRelative } from "@/lib/app/format"
import { adminReportHref, adminReportsHref } from "@/lib/app/admin-routes"
import {
  DEFAULT_REPORT_SORT,
  DEFAULT_REPORT_TAB,
  REPORT_TABS,
  REPORT_TAB_LABELS,
  reportSourceLabel,
  reportStatusView,
} from "@/lib/admin-space/reports"

const NO_NAME = "Compte sans nom"
const AUTO_REPORTER = "Analyse automatique"

const plural = (n, one, many) => (n > 1 ? many : one)

/** Sous-titre : nombre de signalements à traiter. */
export function reportsSubtitle(toHandle) {
  if (toHandle === 0) return "Aucun signalement à traiter"
  return `${toHandle} ${plural(toHandle, "signalement à traiter", "signalements à traiter")}`
}

function Header({ toHandle }) {
  return (
    <div className="head2">
      <div>
        <h1 className="head2__title">Signalements</h1>
        {toHandle === null ? null : (
          <p className="head2__sub">
            <b>{reportsSubtitle(toHandle)}</b>
          </p>
        )}
      </div>
    </div>
  )
}

function Indicators({ counts }) {
  return (
    <StatGroup label="Signalements par état">
      <Stat label="À traiter" value={counts["a-traiter"]} sub="Ouverts ou déjà en cours" />
      <Stat label="Résolus" value={counts.resolus} sub="Décision prise" />
      <Stat label="Classés" value={counts.classes} sub="Sans suite" />
    </StatGroup>
  )
}

function SortLink({ data }) {
  const next = data.sort === "recents" ? "anciens" : "recents"
  const label = data.sort === "recents" ? "Plus récents d'abord" : "Plus anciens d'abord"
  return (
    <div className="a2-filters">
      <span className="caption">Tri : {label.toLowerCase()}</span>
      <Link
        className="btn btn--secondary btn--sm"
        href={adminReportsHref({ statut: data.tab, tri: next === DEFAULT_REPORT_SORT ? undefined : next })}
      >
        <Icon name="i-sort" />
        {next === "recents" ? "Voir les plus récents d'abord" : "Voir les plus anciens d'abord"}
      </Link>
    </div>
  )
}

function Row({ row, now }) {
  const view = reportStatusView(row.status)
  return (
    <tr className="a2-09-row">
      <td data-label="Signalement">
        <Link className="a2-09-title link" href={adminReportHref(row.id)}>
          {row.reference ?? "Signalement"}
        </Link>
        {row.missionTitle ? <div className="a2-09-sub">{row.missionTitle}</div> : null}
      </td>
      <td data-label="Origine">{reportSourceLabel(row.source)}</td>
      <td data-label="Motif">{row.reasonLabel}</td>
      <td data-label="Signalé par">{row.reporter ? row.reporter.name || NO_NAME : AUTO_REPORTER}</td>
      <td data-label="Compte visé">{row.reported?.name || NO_NAME}</td>
      <td data-label="Statut">
        <StatusBadge label={view.label} tone={view.tone} />
        {row.handledBy ? <div className="a2-09-sub">Par {row.handledBy.name || NO_NAME}</div> : null}
      </td>
      <td data-label="Ancienneté">{formatRelative(row.createdAt, now)}</td>
    </tr>
  )
}

const EMPTY_COPY = {
  "a-traiter": {
    icon: "i-check-circle",
    title: "Aucun signalement à traiter",
    text: "Tout est pris en charge. Les signalements des utilisateurs et les alertes automatiques apparaîtront ici.",
  },
  resolus: { icon: "i-inbox", title: "Aucun signalement résolu", text: "Les signalements résolus apparaîtront ici." },
  classes: { icon: "i-inbox", title: "Aucun signalement classé", text: "Les signalements classés sans suite apparaîtront ici." },
}

function Empty({ tab }) {
  const copy = EMPTY_COPY[tab] ?? EMPTY_COPY[DEFAULT_REPORT_TAB]
  return <EmptyState icon={copy.icon} title={copy.title} text={copy.text} />
}

/**
 * File des signalements (AD09). Vue pure : le serveur fournit toutes les données.
 * `data` est la réponse de `listAdminReports` ; `error` vaut son message quand la lecture a échoué.
 * `data.unavailable` : la table des signalements n'existe pas encore, un état « indisponible » remplace la liste.
 */
export function ReportsView({ data, error, now = new Date() }) {
  if (error || !data) {
    return (
      <div className="a2-09">
        <Header toHandle={null} />
        <ErrorState titleAs="h2" title="Les signalements n'ont pas pu être chargés" text={error || undefined} />
      </div>
    )
  }

  if (data.unavailable) {
    return (
      <div className="a2-09">
        <Header toHandle={null} />
        <EmptyState
          icon="i-alert-circle"
          titleAs="h2"
          title="Les signalements ne sont pas disponibles pour le moment"
          text={data.message || "Réessayez plus tard."}
        />
      </div>
    )
  }

  const { tab, counts, items } = data
  const tabs = REPORT_TABS.map((key) => ({
    key,
    label: REPORT_TAB_LABELS[key],
    href: adminReportsHref({ statut: key === DEFAULT_REPORT_TAB ? undefined : key }),
    count: counts[key],
  }))

  return (
    <div className="a2-09">
      <Header toHandle={counts["a-traiter"]} />
      <Indicators counts={counts} />
      <TabsNav label="Signalements par état" items={tabs} activeKey={tab} />
      {items.length > 0 ? (
        <>
          <SortLink data={data} />
          <div className="ds-table-wrap">
            <table className="ds-table a2-tlist">
              <caption className="sr-only">Liste des signalements</caption>
              <thead>
                <tr>
                  <th scope="col">Signalement</th>
                  <th scope="col">Origine</th>
                  <th scope="col">Motif</th>
                  <th scope="col">Signalé par</th>
                  <th scope="col">Compte visé</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Ancienneté</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <Row key={row.id} row={row} now={now} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Empty tab={tab} />
      )}
      <Pager
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        label="Pagination des signalements"
        hrefFor={(page) => adminReportsHref({ statut: tab, tri: data.sort, page })}
      />
    </div>
  )
}

export default ReportsView
