import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { formatAmount } from "@/lib/app/format"
import {
  PAYMENT_WARNING,
  PURCHASE_ESTIMATE_EXCEEDED_NOTE,
  PURCHASE_REVIEWED_LABEL,
  formatPayeeNumber,
  requestNumber,
} from "@/lib/purchases/requests"

// Pastille de chaque statut dans cette carte (la planche C08 écrit « À payer » pour une demande en attente).
const ROW_BADGES = {
  pending: { label: "À payer", tone: "alerte", icon: "i-clock" },
  paid: { label: "Payé", tone: "neutre", icon: "i-check" },
  received: { label: "Reçu par le vendeur", tone: "succes", icon: "i-check-double" },
  reported: { label: "Signalé", tone: "erreur", icon: "i-flag" },
  cancelled: { label: "Annulée", tone: "neutre", icon: "i-x" },
}

/**
 * Première demande en attente de paiement (numéro d'ordre le plus bas) d'un détail de mission, ou null.
 * `purchases` est `detail.purchases` ; indisponible ou sans demande : null.
 * @param {{ available?: boolean, requests?: Array<{ status: string, seq: number }> }|null|undefined} purchases
 */
export function firstPendingRequest(purchases) {
  if (!purchases || purchases.available !== true || !Array.isArray(purchases.requests)) return null
  const pending = purchases.requests.filter((r) => r?.status === "pending")
  if (pending.length === 0) return null
  return pending.reduce((a, b) => (Number(b.seq) < Number(a.seq) ? b : a))
}

/** Compte de demandes payées (payées ou reçues), en attente et signalées, pour la chronologie. */
export function purchasesCounts(purchases) {
  const counts = { paid: 0, pending: 0, reported: 0 }
  if (!purchases || purchases.available !== true || !Array.isArray(purchases.requests)) return counts
  for (const r of purchases.requests) {
    if (r?.status === "pending") counts.pending += 1
    else if (r?.status === "reported") counts.reported += 1
    else if (r?.status === "paid" || r?.status === "received") counts.paid += 1
  }
  return counts
}

function RequestRow({ request }) {
  const badge = ROW_BADGES[request.status] ?? ROW_BADGES.cancelled
  const payee = formatPayeeNumber(request.payeeNumber)
  const sub = [requestNumber(request.seq), formatAmount(request.amount), request.items].filter(Boolean).join(" · ")
  return (
    <div className="buy2">
      <span className="item2__ic">
        <Icon name="i-receipt" />
      </span>
      <div>
        <div className="buy2__title">{request.vendorName}</div>
        <div className="buy2__sub">{sub}</div>
        {payee ? <div className="buy2__sub">Numéro à payer : {payee}</div> : null}
        {request.status === "reported" && request.reviewed ? (
          <div className="buy2__sub">{PURCHASE_REVIEWED_LABEL}</div>
        ) : null}
      </div>
      <StatusBadge label={badge.label} tone={badge.tone} icon={badge.icon} />
    </div>
  )
}

/**
 * Carte « Achats pour votre compte » (C08) : l'estimation donnée à la publication (jamais bloquée, hors séquestre, sans
 * commission) et, quand la fonction est disponible, les demandes de paiement de l'étudiant avec statut, montant, vendeur
 * et numéro à payer, le total payé en direct et le total en attente. Aucune action d'argent : le paiement se fait dans la
 * conversation. Le mot « séquestre » n'est écrit que si une réserve existe (`escrowed` : ligne `reserve` au grand livre).
 * `estimate` vient de purchasesEstimateOf (nombre > 0) ; `purchases` est `detail.purchases` (ST-07), ignoré s'il est
 * indisponible ou sans demande (rendu inchangé).
 */
export function PurchasesCard({ estimate, escrowed = false, purchases }) {
  const requests = purchases?.available === true && Array.isArray(purchases.requests) ? purchases.requests : []
  const totals = requests.length > 0 ? purchases.totals : null
  const rows = [{ label: "Estimation donnée à la publication", value: estimate }]
  if (totals && totals.paid > 0) rows.push({ label: "Payé en direct par MoMo", value: totals.paid })
  if (totals && totals.pending > 0) rows.push({ label: "En attente de votre paiement", value: totals.pending })
  if (totals && totals.reported > 0) rows.push({ label: "Signalé", value: totals.reported })
  return (
    <section className="card2 fup2__purchases" aria-label="Achats pour votre compte">
      <div className="sec2">
        <h2 className="sec2__title">Achats pour votre compte</h2>
        <StatusBadge label="Hors EduCash" icon="i-banknote" />
      </div>
      {requests.length > 0 ? (
        <div>
          {requests.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </div>
      ) : null}
      <Lines rows={rows} />
      {purchases?.exceedsEstimate === true ? (
        <p className="note2">
          <Icon name="i-info" />
          <span>{PURCHASE_ESTIMATE_EXCEEDED_NOTE}</span>
        </p>
      ) : null}
      <p className="note2">
        <Icon name="i-info" />
        <span>
          {escrowed
            ? "Vous payez les vendeurs directement par MoMo. Ces paiements ne passent pas par le séquestre, ne supportent aucune commission et EduCash ne peut pas les rembourser."
            : "Vous payez les vendeurs directement par MoMo. Ces paiements ne supportent aucune commission et EduCash ne peut pas les rembourser."}
        </span>
      </p>
    </section>
  )
}

/**
 * Carte « À faire » d'une demande de paiement en attente (C08) : « <Prénom> vous demande de payer X à <vendeur> »,
 * l'avertissement PAYMENT_WARNING et le bouton encre « Ouvrir la demande » vers la conversation (le paiement s'y fait,
 * jamais depuis cet écran).
 */
export function PaymentTodoCard({ request, others = 0, studentName, href }) {
  const lead = studentName.charAt(0).toUpperCase() + studentName.slice(1)
  return (
    <section className="card2 fup2__status fup2__status--todo" aria-label="À faire">
      <div className="status2">
        <span className="flag2">
          <Icon name="i-zap" />
          À faire
        </span>
        <div className="status2__title">
          {lead} vous demande de payer {formatAmount(request.amount)} à {request.vendorName}
        </div>
        <div className="status2__text">
          Payez directement par MoMo, puis touchez « Payé » sur la carte dans la conversation. {PAYMENT_WARNING}
          {others > 0 ? ` ${others === 1 ? "Une autre demande attend" : `${others} autres demandes attendent`} aussi votre paiement.` : ""}
        </div>
        <div className="actions2">
          <Link className="btn btn--dark" href={href}>
            <Icon name="i-receipt" />
            Ouvrir la demande
          </Link>
        </div>
      </div>
    </section>
  )
}

export default PurchasesCard
