// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { TabsNav } from "@/components/app-ui/tabs-nav"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { SkeletonRows } from "@/components/app-ui/skeletons"
import { splitAmount } from "@/components/app-ui/amount"
import { COMMISSION_RATE, missionTypeLabel } from "@/lib/constants/missions"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"
import { formatAmount, formatShortDate } from "@/lib/app/format"
import { applicationStatusView } from "@/lib/app/application-status"
import { missionStatusView } from "@/lib/app/mission-status"
import {
  studentApplicationsHref,
  studentConversationHref,
  studentMissionHref,
  studentMissionsHref,
  studentReviewHref,
} from "@/lib/app/student-routes"
import { APPLICATION_TABS } from "@/lib/student-space/applications-tabs"

const EXPLORE = { label: "Explorer les missions", href: studentMissionsHref() }
// Prénom trop long pour le bouton (320 px) : libellé neutre.
const NAME_MAX = 14
const COMMISSION_PERCENT = `${Math.round(COMMISSION_RATE * 100)} %`

const EMPTY = {
  "en-attente": {
    icon: "i-clock",
    title: "Aucune candidature en attente",
    text: "Parcours les missions ouvertes et postule à celles qui te conviennent.",
    action: EXPLORE,
  },
  "en-cours": {
    icon: "i-briefcase",
    title: "Aucune mission en cours",
    text: "Quand un client retient ta candidature, la mission apparaît ici avec l'argent bloqué pour toi.",
    action: EXPLORE,
  },
  terminees: {
    icon: "i-check-circle",
    title: "Aucune mission terminée",
    text: "Tes missions terminées, ce que tu as gagné et les avis à laisser apparaîtront ici.",
  },
  "non-retenues": {
    icon: "i-inbox",
    title: "Aucune candidature non retenue",
    text: "Les candidatures refusées et les missions attribuées à quelqu'un d'autre apparaissent ici.",
  },
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

function headDate({ total, counts }) {
  if (total === 0) return "Aucune candidature pour l'instant"
  return `${plural(total, "candidature", "candidatures")} · ${counts["en-attente"]} en attente · ${counts["en-cours"]} en cours`
}

// Pastille de statut et ligne sous la pastille, selon l'onglet.
function statusOf(row, tab) {
  if (tab === "en-cours") {
    const view = missionStatusView({ status: row.missionStatus })
    return { view, icon: undefined, note: `Retenue le ${formatShortDate(row.updatedAt)}` }
  }
  if (tab === "terminees") {
    const view = missionStatusView({ status: row.missionStatus })
    const note = row.review
      ? `Avis laissé${row.review.rating ? ` : ${row.review.rating} / 5` : ""}`
      : "Avis à laisser"
    return { view, icon: "i-check", note }
  }
  if (tab === "non-retenues") {
    if (row.missionStatus === "cancelled") {
      return { view: missionStatusView({ status: "cancelled" }), icon: "i-ban", note: "Mission annulée par le client" }
    }
    const view = applicationStatusView("rejected")
    if (row.missionId === null) return { view, icon: undefined, note: "Mission attribuée ou retirée" }
    if (row.status === "rejected") return { view, icon: undefined, note: `Postulée le ${formatShortDate(row.appliedAt)}` }
    return { view, icon: undefined, note: "Mission attribuée à un autre étudiant" }
  }
  return { view: applicationStatusView(row.status), icon: undefined, note: `Postulée le ${formatShortDate(row.appliedAt)}` }
}

const GAIN_NOTE = { "en-cours": "en séquestre", terminees: "versés" }

function subtitleOf(row) {
  const parts = []
  if (row.type) parts.push(missionTypeLabel(row.type))
  if (row.clientName) parts.push(row.clientName)
  if (row.city) parts.push(row.city)
  const date = formatShortDate(row.deadline)
  if (date) parts.push(`avant le ${date}`)
  return parts.join(" · ")
}

// Actions en liens, la plus importante à gauche (la ligne les aligne à droite).
function actionsOf(row, tab) {
  if (row.missionId === null) return []
  const mission = { label: tab === "en-cours" ? "Voir" : "Voir la mission", href: studentMissionHref(row.missionId) }
  if (tab === "en-cours") return [{ label: "Écrire au client", href: studentConversationHref(row.missionId) }, mission]
  if (tab === "terminees" && !row.review) return [{ label: "Noter le client", href: studentReviewHref(row.missionId) }, mission]
  return [mission]
}

function Action({ action, title }) {
  return (
    <Link className="e2-link" href={action.href} aria-label={`${action.label} : ${title}`}>
      {action.label}
    </Link>
  )
}

function Row({ row, tab }) {
  const { view, icon, note } = statusOf(row, tab)
  const actions = actionsOf(row, tab)
  const money = row.missionId === null ? null : splitAmount(row.net)
  const off = tab === "non-retenues"
  return (
    <div role="listitem" className={off ? "e2-04-row is-off" : "e2-04-row"}>
      <span className="item2__ic">
        <Icon name={TYPE_ICON[row.type] ?? "i-briefcase"} />
      </span>
      <div>
        <div className="item2__title">{row.title}</div>
        <div className="item2__sub">{subtitleOf(row)}</div>
      </div>
      <div className="e2-04-status">
        <StatusBadge label={view.label} tone={view.tone} icon={icon} />
        <span>{note}</span>
      </div>
      {money ? (
        <div className="e2-04-gain">
          <span className="e2-amount">
            {money.text}
            <small>{money.unit}</small>
          </span>
          <span>{`${GAIN_NOTE[tab] ?? "ta part"} · budget ${splitAmount(row.budget).text}`}</span>
        </div>
      ) : (
        <span />
      )}
      {actions.length > 0 ? (
        <div className="e2-04-acts">
          {actions.map((a) => (
            <Action key={a.href} action={a} title={row.title} />
          ))}
        </div>
      ) : (
        <span />
      )}
    </div>
  )
}

// Candidature retenue récemment : carte blanche, seule étiquette citron de l'écran, un seul bouton encre.
function Highlight({ highlight }) {
  const date = formatShortDate(highlight.deadline)
  const writeTo = highlight.clientFirst && highlight.clientFirst.length <= NAME_MAX ? `Écrire à ${highlight.clientFirst}` : "Écrire au client"
  const where = highlight.city ? ` à ${highlight.city}` : ""
  const text = [
    `${highlight.title}${where}.`,
    date ? `Avant le ${date}${date.endsWith(".") ? "" : "."}` : "",
    `${formatAmount(highlight.net)} sont bloqués pour toi en séquestre (ta part, commission de ${COMMISSION_PERCENT} déduite).`,
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <section className="card2 e2-04-hl" aria-label="Candidature retenue">
      <div>
        <span className="flag2">
          <Icon name="i-check-circle" />
          {`Retenue le ${formatShortDate(highlight.acceptedAt)}`}
        </span>
        <h2 className="hero2__title">
          {highlight.clientFirst ? `${highlight.clientFirst} a retenu ta candidature` : "Un client a retenu ta candidature"}
        </h2>
        <p className="hero2__text">{text}</p>
      </div>
      <div className="hero2__actions">
        <Link className="btn btn--dark" href={studentConversationHref(highlight.missionId)}>
          <Icon name="i-message" />
          {writeTo}
        </Link>
        <Link className="hero2__link" href={studentMissionHref(highlight.missionId)}>
          Voir la mission
        </Link>
      </div>
    </section>
  )
}

function EscrowNote({ escrow }) {
  return (
    <div className="e2-note">
      <Icon name="i-lock" />
      <div className="e2-note__body">
        <b>{formatAmount(escrow.total)}</b>
        {` bloqués pour toi en séquestre sur ${plural(escrow.count, "mission", "missions")} (ta part, commission de ${COMMISSION_PERCENT} déduite). `}
        <span className="e2-note__text">
          Chaque montant est versé sur ton portefeuille quand le client valide la fin de la mission, jamais automatiquement.
        </span>
      </div>
    </div>
  )
}

const HEAD_ACTION = (
  <Link className="btn btn--soft" href={studentMissionsHref()}>
    <Icon name="i-search" />
    Explorer les missions
  </Link>
)

/** Squelette de la page (loading.js). */
export function StudentApplicationsSkeleton() {
  return (
    <div className="page2">
      <PageHead title="Mes candidatures" />
      <SkeletonRows count={4} />
    </div>
  )
}

/**
 * Mes candidatures (E04). Vue pure : `result` est la réponse de `getStudentApplicationsView`, soit `{ error }`,
 * soit `{ data }` (onglet affiché, compteurs, lignes, séquestre, candidature retenue récemment).
 * @param {{ result?: { data?: import("@/lib/actions/student-applications.actions").StudentApplicationsData, error?: string } }} props
 */
export function StudentApplicationsView({ result }) {
  const data = result?.data
  if (!data) {
    return (
      <div className="page2">
        <ErrorState
          titleAs="h1"
          title="Impossible de charger tes candidatures"
          text="Le chargement a échoué. Tes candidatures et ton argent ne sont pas touchés."
        />
      </div>
    )
  }
  const { tab, counts, total, rows, escrow, highlight } = data
  const items = APPLICATION_TABS.map((t) => ({
    key: t.id,
    label: t.label,
    count: counts[t.id],
    href: studentApplicationsHref({ onglet: t.id }),
  }))
  const empty = EMPTY[tab]
  const label = APPLICATION_TABS.find((t) => t.id === tab)?.label
  return (
    <div className="page2">
      <PageHead date={headDate({ total, counts })} title="Mes candidatures" actions={HEAD_ACTION} />
      {highlight && tab !== "en-cours" ? <Highlight highlight={highlight} /> : null}
      <TabsNav label="Mes candidatures par statut" activeKey={tab} items={items} />
      {tab === "en-cours" && escrow.count > 0 ? <EscrowNote escrow={escrow} /> : null}
      {rows.length === 0 ? (
        <section className="card2 card2--flush" aria-label={empty.title}>
          <EmptyState icon={empty.icon} title={empty.title} text={empty.text} action={empty.action} />
        </section>
      ) : (
        <div className="e2-04-list" aria-label={label} role="list">
          {rows.map((row) => (
            <Row key={row.id} row={row} tab={tab} />
          ))}
        </div>
      )}
    </div>
  )
}

export default StudentApplicationsView
