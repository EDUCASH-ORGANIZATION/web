// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { SectionCard } from "@/components/app-ui/section-card"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Lines } from "@/components/app-ui/lines"
import { ErrorState } from "@/components/app-ui/state-block"
import { EmptyState } from "@/components/app-ui/empty-state"
import { formatAmount, formatShortDate } from "@/lib/app/format"
import { missionStatusView } from "@/lib/app/mission-status"
import { adminMissionsHref, adminReportHref, adminUserHref } from "@/lib/app/admin-routes"
import { missionTypeLabel } from "@/lib/constants/missions"
import { transactionTypeLabel } from "@/lib/admin-space/labels"
import {
  applicationStatusLabel,
  buildMissionTimeline,
  moneySummary,
  purchaseReasonLabel,
  purchaseTimeline,
  reporterLabel,
} from "@/lib/admin-space/mission-detail"
import { reportStatusView } from "@/lib/admin-space/reports"
import { PAYEE_KINDS, formatPayeeNumber, statusBadge } from "@/lib/purchases/requests"

const BENIN_TZ = "Africa/Porto-Novo"
const NO_NAME = "Compte sans nom"

/** Date et heure au Bénin, ex. « 8 oct. · 09:02 ». Chaîne vide si la date est absente ou illisible. */
export function momentLabel(iso) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: BENIN_TZ }).format(date)
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: BENIN_TZ }).format(date)
  return `${day} · ${time}`
}

function BackLink() {
  return (
    <Link className="head2__back" href={adminMissionsHref()}>
      <Icon name="i-arrow-left" />
      Missions
    </Link>
  )
}

function Header({ data }) {
  const { mission } = data
  const view = missionStatusView({ status: mission.status, deadline: mission.deadline }, data.today)
  const confirm = mission.status === "in_progress" && Boolean(data.completion?.declaredAt)
  const facts = [missionTypeLabel(mission.type), mission.city, formatAmount(mission.budget)].filter(Boolean)
  return (
    <div className="head2">
      <div>
        <BackLink />
        <h1 className="head2__title">{mission.title || "Mission sans titre"}</h1>
        <p className="head2__sub">
          <StatusBadge label={view.label} tone={view.tone} />
          {confirm ? <b> Fin à confirmer</b> : null}
          {` · ${facts.join(" · ")}`}
          {mission.deadline ? ` · échéance ${formatShortDate(mission.deadline)}` : ""}
        </p>
      </div>
    </div>
  )
}

function PartyLink({ party, fallback }) {
  if (!party) return fallback
  return (
    <Link className="link" href={adminUserHref(party.id)}>
      {party.name || NO_NAME}
    </Link>
  )
}

function Parties({ data }) {
  const { applications } = data
  return (
    <SectionCard title="Parties et candidatures" count={applications.total}>
      <dl className="a2-kv">
        <dt>Client</dt>
        <dd>
          <PartyLink party={data.client} fallback="Inconnu" />
        </dd>
        <dt>Étudiant retenu</dt>
        <dd>
          <PartyLink party={data.student} fallback="Aucun étudiant retenu" />
        </dd>
      </dl>
      {applications.items.length > 0 ? (
        <ul className="a2-07-apps" aria-label="Candidatures reçues">
          {applications.items.map((app) => (
            <li key={app.id} className="a2-07-app">
              <Link className="link" href={adminUserHref(app.studentId)}>
                {app.name || NO_NAME}
              </Link>
              <span className="a2-06-sub">
                {applicationStatusLabel(app.status)}
                {app.createdAt ? ` · ${momentLabel(app.createdAt)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="a2-06-sub">Aucune candidature reçue.</p>
      )}
      {applications.total > applications.items.length ? (
        <p className="a2-06-sub">
          {applications.items.length} candidatures affichées sur {applications.total}.
        </p>
      ) : null}
    </SectionCard>
  )
}

const UNAVAILABLE_COPY = {
  missing: "Les demandes de paiement d'achats ne sont pas disponibles pour le moment.",
  error: "Les demandes de paiement d'achats n'ont pas pu être chargées. Rechargez la page.",
}

const PROOFS = [
  { key: "payeePhotoUrl", label: "Numéro ou panneau", icon: "i-image" },
  { key: "ticketPhotoUrl", label: "Ticket", icon: "i-receipt" },
  { key: "smsPhotoUrl", label: "Capture du SMS", icon: "i-smartphone" },
]

function amountNote(status) {
  if (status === "pending") return "à payer hors EduCash"
  if (status === "paid" || status === "received") return "payé hors EduCash"
  return "hors EduCash"
}

/** Une preuve : lecture par une URL signée courte ; sans URL, une tuile vide explicite (jamais d'image cassée). */
function ProofTile({ proof, url, status }) {
  if (!url) {
    const reason = proof.key === "smsPhotoUrl" && status === "pending" ? "pas encore jointe" : "indisponible"
    return (
      <div className="ad-proof is-missing" role="img" aria-label={`${proof.label} : ${reason}`}>
        <span className="ad-proof__ic">
          <Icon name={proof.icon} />
        </span>
        <span className="ad-proof__lab">{proof.label}</span>
      </div>
    )
  }
  return (
    <div className="ad-proof">
      <a className="a2-07-proof" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir : ${proof.label}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="a2-07-proof__img" src={url} alt={proof.label} loading="lazy" referrerPolicy="no-referrer" />
      </a>
      <span className="ad-proof__ic">
        <Icon name={proof.icon} />
      </span>
      <span className="ad-proof__lab">{proof.label}</span>
    </div>
  )
}

function LinkedReports({ request, reportsAvailable }) {
  if (!reportsAvailable) return <p className="a2-06-sub">Signalements liés : indisponibles</p>
  if (request.reports.length === 0) return <p className="a2-06-sub">Signalements liés : aucun</p>
  return (
    <div>
      <h3 className="a2-06-sub">Signalements liés</h3>
      <ul className="a2-07-apps" aria-label={`Signalements liés à la demande ${request.number}`}>
        {request.reports.map((report) => {
          const view = reportStatusView(report.status)
          return (
            <li key={report.id} className="a2-07-app">
              <span>
                <Link className="link" href={adminReportHref(report.id)}>
                  {report.reference || "Signalement"}
                </Link>
                {` · ${purchaseReasonLabel(report.reason)}`}
              </span>
              <span className="a2-06-sub">
                <StatusBadge label={view.label} tone={view.tone} />
                {` par ${reporterLabel(report.byRole)}`}
                {report.createdAt ? ` · ${momentLabel(report.createdAt)}` : ""}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PurchaseCard({ request, reportsAvailable }) {
  const flagged = request.status === "reported" || request.reports.length > 0
  const badge = statusBadge(request.status)
  const kind = PAYEE_KINDS.find((k) => k.value === request.payeeKind)?.label ?? "Numéro à payer"
  const steps = purchaseTimeline(request)
  return (
    <article
      className={`ad-payreq ad-payreq--compact ad07-payreq${flagged ? " is-flagged" : ""}`}
      aria-label={`Demande de paiement ${request.number}`}
    >
      <div className="ad-payreq__head">
        <span className={`ic-sq ic-sq--sm${flagged ? " ic-sq--erreur" : ""}`}>
          <Icon name="i-receipt" />
        </span>
        <div>
          <b>{request.vendorName || "Vendeur sans nom"}</b>
          <small>{[request.items, request.number].filter(Boolean).join(" · ")}</small>
        </div>
        <div className="ad-payreq__amt">
          {formatAmount(request.amount)}
          <small>{amountNote(request.status)}</small>
        </div>
      </div>
      <div className="ad-payreq__proofs">
        {PROOFS.map((proof) => (
          <ProofTile key={proof.key} proof={proof} url={request[proof.key]} status={request.status} />
        ))}
      </div>
      <dl className="a2-kv">
        <dt>{kind}</dt>
        <dd>{formatPayeeNumber(request.payeeNumber) || request.payeeNumber || "Inconnu"}</dd>
        {request.paidReference ? (
          <>
            <dt>Référence de paiement</dt>
            <dd>{request.paidReference}</dd>
          </>
        ) : null}
      </dl>
      <div className="ad-payreq__foot">
        <StatusBadge label={badge.label || "Statut inconnu"} tone={badge.variant} />
        <span>{steps.map((step) => `${step.label} ${momentLabel(step.at)}`).join(" - ")}</span>
      </div>
      <LinkedReports request={request} reportsAvailable={reportsAvailable} />
    </article>
  )
}

function PurchasesTotals({ totals }) {
  const rows = [
    totals.estimate ? { label: "Estimation à la publication", value: totals.estimate } : null,
    { label: "Payés en direct", value: totals.paid },
    { label: "En attente de paiement", value: totals.pending },
    { label: "Signalés", value: totals.reported },
  ].filter(Boolean)
  return (
    <div className="recap ad-indic" aria-label="Totaux des achats, hors EduCash">
      {rows.map((row) => (
        <div className="recap__line" key={row.label}>
          <span>{row.label}</span>
          <b>{formatAmount(row.value)}</b>
        </div>
      ))}
      <div className="recap__line recap__total">
        <span>Total des demandes, indicatif et non encaissé</span>
        <b>{formatAmount(totals.requested)}</b>
      </div>
    </div>
  )
}

/**
 * Achats pour le compte du client (décision 24) : demandes payées par le client directement au vendeur, HORS EduCash.
 * Jamais additionnés à l'argent de la mission (séquestre, commission, net). Bloc absent si la mission n'a ni
 * estimation ni demande, ou si la fonction n'est pas disponible et que rien n'est annoncé.
 */
function Purchases({ purchases }) {
  if (!purchases) return null
  const title = "Achats pour le compte du client"
  if (!purchases.available) {
    if (purchases.reason !== "error" && !purchases.estimate) return null
    return (
      <SectionCard title={title}>
        <p className="a2-note">
          <Icon name="i-info" className="ic" />
          <span>{UNAVAILABLE_COPY[purchases.reason] ?? UNAVAILABLE_COPY.missing}</span>
        </p>
      </SectionCard>
    )
  }
  if (purchases.items.length === 0 && !purchases.estimate) return null
  const count = purchases.items.length
  return (
    <SectionCard title={title} count={`${count} demande${count > 1 ? "s" : ""}`}>
      <p className="a2-note">
        <Icon name="i-info" className="ic" />
        <span>
          Payés par le client directement au vendeur par MoMo, <b>hors EduCash</b> : ni séquestre, ni commission, et
          EduCash ne peut pas les rembourser.
        </span>
      </p>
      {count === 0 ? (
        <EmptyState
          compact
          icon="i-receipt"
          title="Aucune demande de paiement"
          text={`Achats annoncés à la publication (estimation ${formatAmount(purchases.estimate)}), aucune demande envoyée pour l'instant.`}
        />
      ) : (
        <>
          {purchases.items.map((request) => (
            <PurchaseCard key={request.id} request={request} reportsAvailable={purchases.reportsAvailable} />
          ))}
          <PurchasesTotals totals={purchases.totals} />
        </>
      )}
    </SectionCard>
  )
}

function Timeline({ data }) {
  const items = buildMissionTimeline({
    mission: data.mission,
    studentName: data.student?.name ?? "",
    completion: data.completion,
    ledger: data.ledger,
    clientId: data.mission.clientId,
  })
  return (
    <SectionCard title="Suivi de la mission">
      <ol className="timeline">
        {items.map((item, index) => (
          <li key={`${index}-${item.title}`} className={`tl-item is-${item.state}`}>
            <span className="tl-item__dot">
              <Icon name={item.icon} />
            </span>
            <div>
              <div className="tl-item__title">{item.title}</div>
              {item.at ? <div className="tl-item__meta">{momentLabel(item.at)}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}

function Reviews({ data }) {
  if (data.reviews.length === 0) return null
  const author = (role) => (role === "client" ? "Le client" : role === "student" ? "L'étudiant" : "Un participant")
  return (
    <SectionCard title="Avis" count={data.reviews.length}>
      <ul className="a2-07-apps">
        {data.reviews.map((review) => (
          <li key={review.id} className="a2-07-app">
            <b>
              {author(review.byRole)} : {review.rating} sur 5
            </b>
            {review.comment ? <span>{review.comment}</span> : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

function Money({ data }) {
  const money = moneySummary({ budget: data.mission.budget, clientId: data.mission.clientId, ledger: data.ledger })
  const rows = [
    { label: "Budget de la mission", value: money.planned.total },
    { label: "Commission prévue", value: money.planned.commission },
    { label: "Part prévue de l'étudiant", value: money.planned.student },
  ]
  const moved = [
    { label: "Réservé en séquestre", value: money.reserved },
    { label: "Libéré du séquestre", value: money.released },
    { label: "Commission prélevée", value: money.commission },
    { label: "Reçu par l'étudiant", value: money.studentReceived },
    { label: "Remboursé au client", value: money.refunded },
  ]
  return (
    <section className="a2-07-money" aria-label="Argent de la mission">
      <h2 className="a2-sec__title">Argent</h2>
      <Lines rows={rows} />
      <h3 className="a2-06-sub">Mouvements enregistrés</h3>
      {money.hasMovements ? (
        <>
          <Lines rows={moved} total={{ label: "Encore en séquestre", value: money.inEscrow }} />
          <ul className="a2-07-apps" aria-label="Mouvements du portefeuille">
            {data.ledger.map((move) => (
              <li key={move.id} className="a2-07-app">
                <span>
                  {transactionTypeLabel(move.type)}
                  {move.party === "client" ? " · client" : move.party === "student" ? " · étudiant" : ""}
                </span>
                <span className="a2-06-sub">
                  {formatAmount(move.amount)} · {momentLabel(move.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="a2-06-sub">Aucun mouvement d&apos;argent enregistré pour cette mission.</p>
      )}
      <p className="a2-note">
        <Icon name="i-info" className="ic" />
        <span>Aucune action d&apos;argent depuis cet écran. Pour un litige, contactez les parties.</span>
      </p>
    </section>
  )
}

/**
 * Détail d'une mission (AD07), en lecture seule. Vue pure : le serveur fournit toutes les données.
 * `data` est la réponse de `getAdminMissionDetail` ; `error` vaut son message quand la lecture a échoué.
 */
export function MissionDetailView({ data, error }) {
  if (error || !data) {
    return (
      <div className="a2-07">
        <BackLink />
        <ErrorState titleAs="h1" title="Cette mission n'a pas pu être chargée" text={error || undefined} />
      </div>
    )
  }

  const { mission } = data
  return (
    <div className="a2-07">
      <Header data={data} />
      <div className="a2-split">
        <div className="stack stack--3">
          {mission.description ? (
            <SectionCard title="Description">
              <p className="a2-07-desc">{mission.description}</p>
            </SectionCard>
          ) : null}
          <Parties data={data} />
          <Purchases purchases={data.purchases} />
          <Timeline data={data} />
          <Reviews data={data} />
        </div>
        <Money data={data} />
      </div>
    </div>
  )
}

export default MissionDetailView
