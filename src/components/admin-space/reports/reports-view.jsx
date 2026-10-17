// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { TabsNav } from "@/components/app-ui/tabs-nav"
import { ChipFilter } from "@/components/app-ui/chip-filter"
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
const PURCHASE_TYPE = "demande-paiement-achats"

// Filtre de type : valeur d'URL (`type`), libellé de la puce. Tous les types : paramètre absent.
const TYPE_OPTIONS = [
  { value: "", label: "Tous les types" },
  { value: "messages", label: "Messages" },
  { value: PURCHASE_TYPE, label: "Demandes de paiement d'achats" },
]

// Adresse de la file : `adminReportsHref` ne connaît pas le filtre de type, il est ajouté ici.
function listHref({ statut, tri, page, type }) {
  const href = adminReportsHref({ statut, tri, page })
  return type ? `${href}${href.includes("?") ? "&" : "?"}type=${encodeURIComponent(type)}` : href
}

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
      <span className="caption">Tri : {label.toLowerCase()}. Les demandes de paiement d&apos;achats passent toujours en premier.</span>
      <Link
        className="btn btn--secondary btn--sm"
        href={listHref({ statut: data.tab, tri: next === DEFAULT_REPORT_SORT ? undefined : next, type: data.type })}
      >
        <Icon name="i-sort" />
        {next === "recents" ? "Voir les plus récents d'abord" : "Voir les plus anciens d'abord"}
      </Link>
    </div>
  )
}

function TypeFilter({ data }) {
  const options = TYPE_OPTIONS.map((o) => ({
    ...o,
    href: listHref({ statut: data.tab, tri: data.sort, type: o.value }),
  }))
  return (
    <div className="a2-filters">
      <ChipFilter label="Filtrer par type de signalement" options={options} value={data.type ?? ""} />
      {data.type ? (
        <span className="a2-filters__count" role="status">
          {data.total} {plural(data.total, "résultat", "résultats")}
        </span>
      ) : null}
    </div>
  )
}

function PurchaseNote() {
  return (
    <p className="a2-note">
      <Icon name="i-info" className="ic" />
      <span>
        Ces achats ont été payés par MoMo <b>hors EduCash</b>. Les montants sont déclaratifs : EduCash ne peut ni les rembourser ni les
        compenser. L&apos;équipe examine le signalement, le clôt et prévient les deux parties.
      </span>
    </p>
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
        {row.targetDetail ? <div className="a2-09-sub">{row.targetDetail}</div> : null}
        {row.missionTitle ? <div className="a2-09-sub">{row.missionTitle}</div> : null}
      </td>
      <td data-label="Type">{row.typeLabel || "Message"}</td>
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
    href: listHref({ statut: key === DEFAULT_REPORT_TAB ? undefined : key, type: data.type }),
    count: counts[key],
  }))

  return (
    <div className="a2-09">
      <Header toHandle={counts["a-traiter"]} />
      <Indicators counts={counts} />
      <TabsNav label="Signalements par état" items={tabs} activeKey={tab} />
      <TypeFilter data={data} />
      {data.type === PURCHASE_TYPE ? <PurchaseNote /> : null}
      {items.length > 0 ? (
        <>
          <SortLink data={data} />
          <div className="ds-table-wrap">
            <table className="ds-table a2-tlist">
              <caption className="sr-only">Liste des signalements</caption>
              <thead>
                <tr>
                  <th scope="col">Signalement</th>
                  <th scope="col">Type</th>
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
        hrefFor={(page) => listHref({ statut: tab, tri: data.sort, page, type: data.type })}
      />
    </div>
  )
}

export default ReportsView
