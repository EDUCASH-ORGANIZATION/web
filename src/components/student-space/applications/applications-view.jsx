// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
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
const SHARE_PERCENT = `${Math.round((1 - COMMISSION_RATE) * 100)} %`
const BENIN_TZ = "Africa/Porto-Novo"

const dayKey = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: BENIN_TZ }).format(date)

// Heure au fuseau du Bénin, ex. "9:12" ou "17:40". "" si la date est absente ou invalide.
function clockOf(iso) {
  const date = new Date(iso ?? NaN)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", minute: "2-digit", hourCycle: "h23", timeZone: BENIN_TZ }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("hour")}:${get("minute")}`
}

// « aujourd'hui à 9:12 », « hier à 17:40 » ou « le jeu. 1 oct. à 17:40 ».
function whenOf(iso, now) {
  const date = new Date(iso ?? NaN)
  const clock = clockOf(iso)
  if (!clock) return ""
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const day = dayKey(date)
  if (day === today) return `aujourd'hui à ${clock}`
  if (day === yesterday) return `hier à ${clock}`
  return `le ${formatShortDate(iso)} à ${clock}`
}

const isAmount = (n) => Number.isFinite(n) && n > 0

const EMPTY = {
  "en-attente": {
    icon: "i-clock",
    title: "Aucune candidature en attente",
    text: "Parcourez les missions ouvertes et postulez à celles qui vous conviennent.",
    action: EXPLORE,
  },
  "en-cours": {
    icon: "i-briefcase",
    title: "Aucune mission en cours",
    text: "Quand un client retient votre candidature, la mission apparaît ici avec l'argent bloqué pour vous.",
    action: EXPLORE,
  },
  terminees: {
    icon: "i-check-circle",
    title: "Aucune mission terminée",
    text: "Vos missions terminées, ce que vous avez gagné et les avis à laisser apparaîtront ici.",
  },
  "non-retenues": {
    icon: "i-inbox",
    title: "Aucune candidature non retenue",
    text: "Les candidatures refusées et les missions attribuées à quelqu'un d'autre apparaissent ici.",
  },
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

// Le total n'est affiché qu'à partir de 1024 px (la planche mobile ne garde que les deux compteurs).
function headDate({ total, counts }) {
  if (total === 0) return "Aucune candidature pour l'instant"
  return (
    <>
      <span className="e2-04-total">{`${plural(total, "candidature", "candidatures")} · `}</span>
      {`${counts["en-attente"]} en attente · ${counts["en-cours"]} en cours`}
    </>
  )
}

// Pastille de statut et ligne sous la pastille, selon l'onglet.
function statusOf(row, tab, unread) {
  if (unread && row.status === "pending" && tab === "en-attente") {
    return { view: applicationStatusView(row.status), icon: undefined, note: `${row.clientFirst} vous a écrit à ${clockOf(unread.at)}` }
  }
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

// Sans paiements, rien n'est bloqué : la part de l'étudiant n'est jamais dite « en séquestre ».
const gainNote = (tab, paymentsOn) => (tab === "terminees" ? "versés" : tab === "en-cours" && paymentsOn ? "en séquestre" : "votre part")

// Message non lu du client sur cette mission (conversation lue côté messagerie) : prénom et heure requis.
function unreadOf(row, unreadByMission) {
  const unread = row.missionId ? unreadByMission?.[row.missionId] : null
  return unread && row.clientFirst && clockOf(unread.at) ? unread : null
}

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
function actionsOf(row, tab, unread) {
  if (row.missionId === null) return []
  const reply = row.clientFirst && row.clientFirst.length <= NAME_MAX ? `Répondre à ${row.clientFirst}` : "Répondre au client"
  let first = null
  if (unread) first = { label: reply, href: studentConversationHref(row.missionId) }
  else if (tab === "en-cours") first = { label: "Écrire au client", href: studentConversationHref(row.missionId) }
  else if (tab === "terminees" && !row.review) first = { label: "Noter le client", href: studentReviewHref(row.missionId) }
  // Deux liens : « Voir » suffit ; un seul : « Voir la mission » (comme la planche).
  const mission = { label: first ? "Voir" : "Voir la mission", href: studentMissionHref(row.missionId) }
  return first ? [first, mission] : [mission]
}

function Action({ action, title }) {
  return (
    <Link className="e2-link" href={action.href} aria-label={`${action.label} : ${title}`}>
      {action.label}
    </Link>
  )
}

function Row({ row, tab, unreadByMission, paymentsOn }) {
  const unread = unreadOf(row, unreadByMission)
  const { view, icon, note } = statusOf(row, tab, unread)
  const actions = actionsOf(row, tab, unread)
  const money = row.missionId === null || !isAmount(row.net) ? null : splitAmount(row.net)
  const off = tab === "non-retenues"
  const gain = isAmount(row.budget) ? `${gainNote(tab, paymentsOn)} · budget ${splitAmount(row.budget).text}` : gainNote(tab, paymentsOn)
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
          <span>{gain}</span>
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
function Highlight({ highlight, now, paymentsOn }) {
  const date = formatShortDate(highlight.deadline)
  const writeTo = highlight.clientFirst && highlight.clientFirst.length <= NAME_MAX ? `Écrire à ${highlight.clientFirst}` : "Écrire au client"
  const when = whenOf(highlight.acceptedAt, now)
  const who = highlight.clientName || "Un client"
  const where = highlight.city ? `à ${highlight.city}` : ""
  const place = [date ? `Avant le ${date}` : "", where].filter(Boolean).join(" ")
  // Bureau : phrase complète ; mobile (planche) : titre de la mission en tête, phrase abrégée.
  const amount = isAmount(highlight.net) ? formatAmount(highlight.net) : ""
  const showText = Boolean(place || amount)
  return (
    <section className="card2 e2-04-hl" aria-label="Candidature retenue">
      <div className="e2-04-hl__body">
        <span className="flag2">
          <Icon name="i-check-circle" />
          {when ? `Retenue ${when}` : "Retenue"}
        </span>
        <h2 className="hero2__title">
          {`${who} a retenu votre candidature`}
          <span className="e2-04-hl__for">{` pour « ${highlight.title} »`}</span>
        </h2>
        {showText ? (
          <p className="hero2__text">
            <span className="e2-04-hl__what">{`${highlight.title} · `}</span>
            {place ? (place.endsWith(".") ? place : `${place}.`) : ""}
            {place && amount ? " " : ""}
            {amount && paymentsOn ? (
              <>
                {`${amount} `}
                <span className="e2-04-hl__long">sont </span>
                {"bloqués pour vous en séquestre"}
                <span className="e2-04-hl__long">{` (votre part de ${SHARE_PERCENT})`}</span>
                {"."}
              </>
            ) : null}
            {amount && !paymentsOn ? `Votre part sera de ${amount} (commission de ${COMMISSION_PERCENT} déduite).` : ""}
          </p>
        ) : null}
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
        {` bloqués pour vous en séquestre sur ${plural(escrow.count, "mission", "missions")} (votre part, commission de ${COMMISSION_PERCENT} déduite). `}
        <span className="e2-note__text">
          Chaque montant est versé sur votre portefeuille quand le client valide la fin de la mission, jamais automatiquement.
        </span>
      </div>
    </div>
  )
}

// Absent sous 1024 px : la barre du bas porte déjà « Missions » (planche mobile).
const HEAD_ACTION = (
  <Link className="btn btn--soft e2-04-explore" href={studentMissionsHref()}>
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
 * `unreadByMission` : messages non lus du client, `{ [missionId]: { at } }` (facultatif, voir `unreadByMission`).
 * `paymentsEnabled` : sans paiements, ni séquestre ni montant bloqué n'est affiché.
 * @param {{ result?: { data?: import("@/lib/actions/student-applications.actions").StudentApplicationsData, error?: string },
 *   unreadByMission?: Record<string, { at: string }>, now?: Date | string, paymentsEnabled?: boolean }} props
 */
export function StudentApplicationsView({ result, unreadByMission, now = new Date(), paymentsEnabled = false }) {
  const data = result?.data
  if (!data) {
    return (
      <div className="page2">
        <ErrorState
          titleAs="h1"
          title="Impossible de charger vos candidatures"
          text="Le chargement a échoué. Vos candidatures et votre argent ne sont pas touchés."
        />
      </div>
    )
  }
  const { tab, counts, total, rows, escrow, highlight } = data
  const nowDate = new Date(now)
  const empty = EMPTY[tab]
  const label = APPLICATION_TABS.find((t) => t.id === tab)?.label
  return (
    <div className="page2">
      <PageHead date={headDate({ total, counts })} title="Mes candidatures" actions={HEAD_ACTION} />
      {highlight && tab !== "en-cours" ? <Highlight highlight={highlight} now={nowDate} paymentsOn={paymentsEnabled} /> : null}
      <nav aria-label="Mes candidatures par statut">
        <div className="e2-tabs">
          {APPLICATION_TABS.map((t) => (
            <Link
              key={t.id}
              href={studentApplicationsHref({ onglet: t.id })}
              className={t.id === tab ? "e2-tab is-active" : "e2-tab"}
              aria-current={t.id === tab ? "page" : undefined}
            >
              {t.label}
              {counts[t.id] > 0 ? <b>{counts[t.id]}</b> : null}
            </Link>
          ))}
        </div>
      </nav>
      {tab === "en-cours" && paymentsEnabled && isAmount(escrow.total) && escrow.count > 0 ? <EscrowNote escrow={escrow} /> : null}
      {rows.length === 0 ? (
        <section className="card2 card2--flush" aria-label={empty.title}>
          <EmptyState icon={empty.icon} title={empty.title} text={empty.text} action={empty.action} />
        </section>
      ) : (
        <div className="e2-04-list" aria-label={label} role="list">
          {rows.map((row) => (
            <Row key={row.id} row={row} tab={tab} unreadByMission={unreadByMission} paymentsOn={paymentsEnabled} />
          ))}
        </div>
      )}
    </div>
  )
}

export default StudentApplicationsView
