// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { SectionCard } from "@/components/app-ui/section-card"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { PlaceLinks } from "@/components/messaging/place-links"
import { adminMissionHref, adminReportsHref, adminUserHref } from "@/lib/app/admin-routes"
import {
  detectionRows,
  messageTypeLabel,
  reportMoment,
  reportSourceLabel,
  reportStatusView,
} from "@/lib/admin-space/reports"
import { ReportActions } from "./report-decision-dialog"

const NO_NAME = "Compte sans nom"
const AUTO_REPORTER = "Analyse automatique"

function BackLink() {
  return (
    <Link className="head2__back" href={adminReportsHref()}>
      <Icon name="i-arrow-left" />
      Signalements
    </Link>
  )
}

function Header({ report }) {
  const view = reportStatusView(report.status)
  const moment = reportMoment(report.createdAt)
  return (
    <div className="head2">
      <div>
        <BackLink />
        <h1 className="head2__title">{report.reference ?? "Signalement"}</h1>
        <p className="head2__sub">
          <StatusBadge label={view.label} tone={view.tone} />
          {` · ${report.reasonLabel} · ${reportSourceLabel(report.source)}`}
          {moment ? ` · reçu le ${moment}` : ""}
        </p>
      </div>
    </div>
  )
}

function MessageBlock({ message, report }) {
  if (!message) {
    return (
      <p className="a2-09-sub">
        {report.source === "auto"
          ? "Ce signalement vient de l'analyse automatique : il ne vise pas un message précis."
          : "Le message signalé n'est plus disponible."}
      </p>
    )
  }
  return (
    <div className="a2-10-msg">
      <div className="a2-09-sub">
        {messageTypeLabel(message.type)}
        {message.createdAt ? ` · envoyé le ${reportMoment(message.createdAt)}` : ""}
      </div>
      {message.type === "image" ? (
        message.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="a2-10-msg__img" src={message.mediaUrl} alt="Image signalée" loading="lazy" />
        ) : (
          <p className="a2-10-msg__text">Image indisponible</p>
        )
      ) : message.type === "voice" ? (
        message.mediaUrl ? (
          <audio className="a2-10-msg__audio" src={message.mediaUrl} controls preload="metadata" aria-label="Message vocal signalé" />
        ) : (
          <p className="a2-10-msg__text">Message vocal indisponible</p>
        )
      ) : message.type === "location" ? (
        <PlaceLinks lat={message.lat} lng={message.lng} />
      ) : (
        <p className="a2-10-msg__text">{message.text}</p>
      )}
    </div>
  )
}

function Summary({ report, message }) {
  return (
    <SectionCard title="Signalement">
      <dl className="a2-kv">
        <dt>Motif</dt>
        <dd>{report.reasonLabel}</dd>
        <dt>Origine</dt>
        <dd>{reportSourceLabel(report.source)}</dd>
        {report.details ? (
          <>
            <dt>Description</dt>
            <dd>{report.details}</dd>
          </>
        ) : null}
      </dl>
      <h3 className="a2-09-sub">Message signalé</h3>
      <MessageBlock message={message} report={report} />
    </SectionCard>
  )
}

function Mission({ report }) {
  if (!report.missionId) return null
  return (
    <SectionCard title="Contexte de la mission">
      <p>
        <Link className="link" href={adminMissionHref(report.missionId)}>
          {report.missionTitle || "Mission sans titre"}
        </Link>
      </p>
      <p className="a2-09-sub">Lecture seule : aucune conversation complète n&apos;est affichée ici.</p>
    </SectionCard>
  )
}

function Detections({ report, events }) {
  if (report.source !== "auto") return null
  if (!events) {
    return (
      <SectionCard title="Détections récentes">
        <p className="a2-09-sub">Le journal des détections n&apos;est pas disponible pour le moment.</p>
      </SectionCard>
    )
  }
  const rows = detectionRows(events.byKind)
  return (
    <SectionCard title="Détections récentes" count={events.total}>
      <p className="a2-09-sub">Sur les {events.windowDays} derniers jours. Seul le type est conservé, jamais la valeur détectée.</p>
      {rows.length > 0 ? (
        <ul className="a2-10-events" aria-label="Détections par type">
          {rows.map((row) => (
            <li key={row.kind} className="a2-10-event">
              <span>{row.label}</span>
              <b>{row.count}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="a2-09-sub">Aucune détection sur la période.</p>
      )}
    </SectionCard>
  )
}

function Party({ role, party, fallback }) {
  return (
    <li className="a2-07-app">
      <b>{role}</b>
      {party ? (
        <Link className="link" href={adminUserHref(party.id)}>
          {party.name || NO_NAME}
          <span className="sr-only">{`, voir la fiche`}</span>
        </Link>
      ) : (
        <span>{fallback}</span>
      )}
    </li>
  )
}

function Parties({ report }) {
  return (
    <SectionCard title="Parties">
      <ul className="a2-07-apps" aria-label="Parties concernées">
        <Party role="Signalé par" party={report.reporter} fallback={AUTO_REPORTER} />
        <Party role="Compte visé" party={report.reported} fallback={NO_NAME} />
      </ul>
      {report.reported?.id ? (
        <Link className="link" href={adminUserHref(report.reported.id)}>
          Voir la fiche
        </Link>
      ) : null}
      <p className="a2-note">
        <Icon name="i-info" className="ic" />
        <span>Aucune suspension automatique. Toute décision sur un compte se prend depuis sa fiche.</span>
      </p>
    </SectionCard>
  )
}

function Handling({ report }) {
  if (!report.handledBy && !report.resolutionNote) return null
  return (
    <SectionCard title="Traitement">
      <dl className="a2-kv">
        {report.handledBy ? (
          <>
            <dt>Pris en charge par</dt>
            <dd>{report.handledBy.name || NO_NAME}</dd>
          </>
        ) : null}
        {report.handledAt ? (
          <>
            <dt>Le</dt>
            <dd>{reportMoment(report.handledAt)}</dd>
          </>
        ) : null}
        {report.resolutionNote ? (
          <>
            <dt>Note</dt>
            <dd>{report.resolutionNote}</dd>
          </>
        ) : null}
      </dl>
    </SectionCard>
  )
}

/**
 * Détail d'un signalement (AD10). Vue pure : le serveur fournit toutes les données.
 * `data` est la réponse de `getAdminReport` (`report`, `message`, `events`, ou `unavailable`) ; `error` vaut son
 * message quand la lecture a échoué. Les noms affichés sont des noms publics.
 */
export function ReportDetailView({ data, error }) {
  if (error || !data) {
    return (
      <div className="a2-10">
        <BackLink />
        <ErrorState titleAs="h1" title="Ce signalement n'a pas pu être chargé" text={error || undefined} />
      </div>
    )
  }

  if (data.unavailable || !data.report) {
    return (
      <div className="a2-10">
        <BackLink />
        <EmptyState
          icon="i-alert-circle"
          titleAs="h1"
          title="Les signalements ne sont pas disponibles pour le moment"
          text={data.message || "Réessayez plus tard."}
        />
      </div>
    )
  }

  const { report, message, events } = data
  return (
    <div className="a2-10">
      <Header report={report} />
      <div className="a2-split">
        <div className="stack stack--3">
          <Summary report={report} message={message} />
          <Detections report={report} events={events} />
          <Mission report={report} />
        </div>
        <div className="stack stack--3">
          <SectionCard title="Actions">
            <ReportActions reportId={report.id} reference={report.reference ?? "ce signalement"} status={report.status} />
          </SectionCard>
          <Parties report={report} />
          <Handling report={report} />
        </div>
      </div>
    </div>
  )
}

export default ReportDetailView
