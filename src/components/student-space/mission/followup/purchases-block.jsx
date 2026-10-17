// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { formatFcfa } from "@/lib/app/format"
import { studentConversationHref } from "@/lib/app/student-routes"
import { formatClock } from "@/lib/client-space/conversations"
import { requestNumber, statusBadge } from "@/lib/purchases/requests"
import { clientFirstName } from "@/lib/student-space/mission-view"

const STATUS_ICONS = { pending: "i-clock", paid: "i-check", received: "i-check-circle", reported: "i-flag", cancelled: "i-x" }
const NEW_REQUEST = "Demander un paiement d'achats"

const at = (label, iso) => {
  const clock = formatClock(iso)
  return clock ? `${label} à ${clock}` : label
}

/** Ligne de détail d'une demande : l'étape où elle en est, sans numéro de vendeur ni coordonnée. */
function requestSub(request, who) {
  switch (request.status) {
    case "pending":
      return at("Envoyée", request.sentAt)
    case "paid":
      return request.actions?.confirmReceived
        ? `${who} a payé à ${formatClock(request.paidAt) || "l'instant"} · confirmez quand le vendeur a reçu`
        : at("Payé", request.paidAt)
    case "received":
      return `${at("Payé", request.paidAt)} · ${at("reçu par le vendeur", request.receivedAt)}`
    case "reported":
      return request.reviewed ? "Signalée · examinée par l'équipe EduCash" : "Signalée · l'équipe EduCash l'examine"
    default:
      return "Annulée"
  }
}

function requestTitle(request) {
  return [requestNumber(request.seq), request.vendorName, request.items].filter(Boolean).join(" · ")
}

/** Liste des demandes de paiement d'achats (E05, modèle rétabli) : lecture seule hors mission en cours. */
function RequestsList({ listing, estimate, clientName, missionId, missionStatus }) {
  const first = clientFirstName(clientName)
  const who = first ?? "Le client"
  const { requests, totals } = listing
  const inProgress = missionStatus === "in_progress"
  const canCreate = listing.canCreate === true && inProgress
  const newHref = studentConversationHref(missionId, { achat: "nouveau" })
  const button = (extra) => (
    <Link className={`btn btn--soft btn--sm ${extra}`} href={newHref}>
      <Icon name="i-plus" />
      {NEW_REQUEST}
    </Link>
  )
  return (
    <section className="list2 e2-05-purchases" aria-label="Demandes de paiement d'achats">
      <div className="list2__head">
        <h2 className="list2__title">
          Demandes de paiement d&apos;achats<span>{totals.count}</span>
        </h2>
        {canCreate ? button("ds-desk-only") : null}
      </div>
      {inProgress ? (
        <div className="e2-05-pad-l ds-desk-only">
          <div className="e2-note">
            <Icon name="i-info" />
            <div className="e2-note__body">
              <div className="e2-note__text">
                {`Vous n'avancez jamais d'argent. Chez le vendeur, envoyez une demande : ${first ?? "le client"} paie directement par MoMo. EduCash n'intervient pas dans ce paiement.`}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {requests.map((request) => {
        const badge = statusBadge(request.status)
        return (
          <div className="item2 e2-05-req" key={request.id}>
            <span className="item2__ic">
              <Icon name="i-receipt" />
            </span>
            <div className="e2-05-min">
              <div className="item2__title">{requestTitle(request)}</div>
              <div className="item2__sub">{requestSub(request, who)}</div>
            </div>
            <span className="item2__meta">
              <span className={`badge badge--${badge.variant} badge--sm`}>
                <Icon name={STATUS_ICONS[request.status] ?? "i-clock"} />
                {badge.label}
              </span>
            </span>
            <span className="e2-05-req__amount">{formatFcfa(request.amount)}</span>
            <Link className="item2__action" href={studentConversationHref(missionId, { demande: request.id })}>
              Voir
            </Link>
          </div>
        )
      })}
      <div className="e2-05-foot">
        <div className="e2-kv">
          <div className="e2-kv__row">
            <span>{`${totals.count} ${totals.count > 1 ? "demandes" : "demande"} · total des achats`}</span>
            <b>{formatFcfa(totals.requested)}</b>
          </div>
          {totals.paid > 0 ? (
            <div className="e2-kv__row">
              <span>Payés en direct par le client</span>
              <b>{formatFcfa(totals.paid)}</b>
            </div>
          ) : null}
          <div className="e2-kv__row">
            <span>Estimation de départ (indicative)</span>
            <b>{`≈ ${formatFcfa(estimate)}`}</b>
          </div>
        </div>
        <p className="e2-05-caption">
          {`Payés par ${first ?? "le client"} aux vendeurs par MoMo, hors EduCash : ces montants ne sont ni bloqués ni soumis à la commission.`}
        </p>
        {canCreate ? button("btn--block ds-mob-only") : null}
      </div>
    </section>
  )
}

/**
 * Bloc « Achats » du suivi (E05, mission avec achats).
 * - `listing` : `detail.purchases` (demandes, totaux, `canCreate`). Fonction disponible : la liste des demandes de
 *   paiement avec statut, montant et vendeur, le total demandé et le total payé en direct par le client (hors
 *   séquestre), un lien « Voir » vers la carte de la conversation et, si `canCreate`, le bouton « Demander un
 *   paiement d'achats » qui mène à la conversation (`?achat=nouveau`, qui y ouvre le formulaire ; un seul bouton à l'écran selon la taille). Mission annulée : lecture
 *   seule, et rien s'il n'y a aucune demande ;
 * - `listing` absent ou indisponible (colonne ou table absente, mission sans demande possible) : l'estimation
 *   indicative et la règle « payés par le client directement au vendeur, hors EduCash », sans bouton.
 * `purchases` : estimation valide (purchasesEstimateOf). L'estimation n'est jamais additionnée aux demandes.
 * @param {{ purchases: number, clientName: string, cancelled?: boolean, missionId?: string, missionStatus?: string,
 *   listing?: import("@/lib/actions/student-mission-detail.actions").StudentMissionPurchases }} props
 */
export function PurchasesBlock({ purchases, clientName, cancelled = false, missionId, missionStatus = "in_progress", listing }) {
  const listed = listing?.available === true && Array.isArray(listing.requests) && Boolean(missionId)
  if (listed && (!cancelled || listing.requests.length > 0)) {
    return (
      <RequestsList
        listing={listing}
        estimate={purchases}
        clientName={clientName}
        missionId={missionId}
        missionStatus={cancelled ? "cancelled" : missionStatus}
      />
    )
  }
  if (cancelled) return null
  const who = clientFirstName(clientName) ?? "Le client"
  return (
    <section className="e2-sec e2-05-purchases" aria-label="Achats de la mission">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Achats de la mission</h2>
        <span className="badge badge--neutre badge--sm">Hors EduCash</span>
      </div>
      <div className="e2-sec__body">
        <div className="e2-kv">
          <div className="e2-kv__row">
            <span>Achats estimés · indicatif</span>
            <b>{`≈ ${formatFcfa(purchases)}`}</b>
          </div>
        </div>
        <p className="e2-05-caption">
          {`${who} paie les vendeurs directement par MoMo : ces montants ne sont ni bloqués ni soumis à la commission. Au marché, envoyez-lui la photo du ticket ou des articles dans la conversation.`}
        </p>
      </div>
    </section>
  )
}

export default PurchasesBlock
