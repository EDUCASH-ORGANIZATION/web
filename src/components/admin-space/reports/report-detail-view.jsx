// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { SectionCard } from "@/components/app-ui/section-card"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { PlaceLinks } from "@/components/messaging/place-links"
import { adminMissionHref, adminReportsHref, adminUserHref } from "@/lib/app/admin-routes"
import { formatPurchaseAmount } from "@/lib/purchases/requests"
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
          {report.targetType === "purchase_request" ? ` · ${report.typeLabel}` : ""}
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
  const isPurchase = report.targetType === "purchase_request"
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
      {isPurchase ? null : (
        <>
          <h3 className="a2-09-sub">Message signalé</h3>
          <MessageBlock message={message} report={report} />
        </>
      )}
    </SectionCard>
  )
}

function Proof({ proof }) {
  const moment = reportMoment(proof.at)
  const caption = moment ? `${proof.label} · ${moment}` : proof.label
  if (!proof.url) {
    return (
      <div className="ad-proof is-missing" role="img" aria-label={`${proof.label} : non disponible`}>
        <span className="ad-proof__lab">
          {proof.label}
          <small>Non disponible</small>
        </span>
      </div>
    )
  }
  return (
    <div className="stack stack--2">
      <a href={proof.url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="a2-10-msg__img" src={proof.url} alt={proof.label} loading="lazy" />
        <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
      </a>
      <div className="a2-09-sub">{caption}</div>
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

function PartyLink({ party }) {
  if (!party?.id) return <span>{NO_NAME}</span>
  return (
    <Link className="link" href={adminUserHref(party.id)}>
      {party.name || NO_NAME}
      <span className="sr-only">{`, voir la fiche`}</span>
    </Link>
  )
}

// Demande de paiement d'achats visée (AD10) : lecture seule. Le paiement a eu lieu par MoMo hors EduCash : aucun
// bouton de remboursement ni de compensation, aucune suspension automatique.
function PurchaseBlock({ report, purchase }) {
  if (!purchase) {
    return (
      <SectionCard title="Demande de paiement d'achats">
        <p className="a2-09-sub">La demande signalée n&apos;est plus disponible.</p>
      </SectionCard>
    )
  }
  const open = report.status === "open" || report.status === "in_progress"
  return (
    <SectionCard title="Demande de paiement d'achats">
      <article className={`ad-payreq ad07-payreq${open ? " is-flagged" : ""}`} aria-label={`Détail de la demande ${purchase.number}`}>
        <div className="ad-payreq__head">
          <div>
            <b>{[purchase.number, purchase.vendorName].filter(Boolean).join(" · ")}</b>
            {purchase.payeeNumber ? <small>{`${purchase.payeeKindLabel || "Numéro à payer"} : ${purchase.payeeNumber}`}</small> : null}
          </div>
          <div className="ad-payreq__amt">
            {formatPurchaseAmount(purchase.amount)}
            <small>Montant demandé</small>
          </div>
        </div>
        <div className="ad-payreq__proofs">
          {purchase.proofs.map((proof) => (
            <Proof key={proof.kind} proof={proof} />
          ))}
        </div>
        <div className="ad-payreq__foot">
          <StatusBadge label={purchase.statusLabel || "Statut inconnu"} tone={purchase.statusTone} />
        </div>
      </article>
      <dl className="a2-kv">
        <Fact label="Étudiant">
          <PartyLink party={purchase.student} />
        </Fact>
        <Fact label="Client">
          <PartyLink party={purchase.client} />
        </Fact>
        {purchase.items ? <Fact label="Articles">{purchase.items}</Fact> : null}
        {purchase.createdAt ? <Fact label="Envoyée le">{reportMoment(purchase.createdAt)}</Fact> : null}
        {purchase.paidAt ? <Fact label="Payée le">{reportMoment(purchase.paidAt)}</Fact> : null}
        {purchase.paidAt ? <Fact label="Bénéficiaire vérifié par le client">{purchase.beneficiaryConfirmed ? "Oui" : "Non"}</Fact> : null}
        {purchase.paidReference ? <Fact label="Référence de paiement">{purchase.paidReference}</Fact> : null}
        {purchase.receivedAt ? <Fact label="Reçue par le vendeur le">{reportMoment(purchase.receivedAt)}</Fact> : null}
      </dl>
      <p className="a2-note">
        <Icon name="i-info" className="ic" />
        <span>
          Payé par MoMo <b>hors EduCash</b> : non remboursable par EduCash. Les preuves ci-dessus sont déclaratives.
        </span>
      </p>
      {report.missionId ? (
        <Link className="link" href={adminMissionHref(report.missionId)}>
          Voir la mission et ses achats
        </Link>
      ) : null}
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

  const { report, message, events, purchase } = data
  const isPurchase = report.targetType === "purchase_request"
  return (
    <div className="a2-10">
      <Header report={report} />
      <div className="a2-split">
        <div className="stack stack--3">
          <Summary report={report} message={message} />
          {isPurchase ? <PurchaseBlock report={report} purchase={purchase} /> : null}
          <Detections report={report} events={events} />
          <Mission report={report} />
        </div>
        <div className="stack stack--3">
          <SectionCard title="Actions">
            <ReportActions reportId={report.id} reference={report.reference ?? "ce signalement"} status={report.status} />
            {isPurchase ? (
              <p className="a2-note">
                <Icon name="i-info" className="ic" />
                <span>La clôture prévient les deux parties. Aucun remboursement ni aucune compensation n&apos;est possible depuis cet écran.</span>
              </p>
            ) : null}
          </SectionCard>
          <Parties report={report} />
          <Handling report={report} />
        </div>
      </div>
    </div>
  )
}

export default ReportDetailView
