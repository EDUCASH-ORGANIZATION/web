// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { SectionCard } from "@/components/app-ui/section-card"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Lines } from "@/components/app-ui/lines"
import { ErrorState } from "@/components/app-ui/state-block"
import { formatAmount, formatShortDate } from "@/lib/app/format"
import { missionStatusView } from "@/lib/app/mission-status"
import { adminMissionsHref, adminUserHref } from "@/lib/app/admin-routes"
import { missionTypeLabel } from "@/lib/constants/missions"
import { transactionTypeLabel } from "@/lib/admin-space/labels"
import { applicationStatusLabel, buildMissionTimeline, moneySummary } from "@/lib/admin-space/mission-detail"

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
  const confirm = mission.status === "in_progress" && Boolean(data.completion)
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
          <Timeline data={data} />
          <Reviews data={data} />
        </div>
        <Money data={data} />
      </div>
    </div>
  )
}

export default MissionDetailView
