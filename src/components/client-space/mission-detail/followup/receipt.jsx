import { Icon } from "@/components/design/icon"
import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { formatAmount } from "@/lib/app/format"
import { requestNumber } from "@/lib/purchases/requests"
import { commissionLabel } from "./escrow-card"
import { PurchasesCard } from "./purchases-card"
import { formatMoment, movementDate } from "./timeline"

const PAID_ROW_BADGES = {
  received: { label: "Reçu par le vendeur", tone: "succes", icon: "i-check-double" },
  paid: { label: "Payé", tone: "neutre", icon: "i-check" },
}

/**
 * Demandes d'achats payées en direct (statuts Payé et Reçu) de `detail.purchases`, par numéro d'ordre. Les demandes en
 * attente, signalées ou annulées n'en font jamais partie. Données indisponibles : liste vide.
 * @param {{ available?: boolean, requests?: Array<{ status?: string, seq?: number }> }|null|undefined} purchases
 */
export function paidRequests(purchases) {
  if (!purchases || purchases.available !== true || !Array.isArray(purchases.requests)) return []
  return purchases.requests
    .filter((r) => r && (r.status === "paid" || r.status === "received"))
    .sort((a, b) => Number(a.seq) - Number(b.seq))
}

function safeAmount(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Montant des demandes signalées (contestées), exclues du coût total et de la somme payée. */
function reportedAmount(purchases) {
  return safeAmount(purchases?.totals?.reported)
}

/** Ligne d'un achat payé en direct : vendeur, numéro, montant, articles et statut (Payé ou Reçu par le vendeur). */
export function PaidPurchaseRow({ request }) {
  const badge = PAID_ROW_BADGES[request.status] ?? PAID_ROW_BADGES.paid
  const sub = [requestNumber(request.seq), formatAmount(request.amount), request.items].filter(Boolean).join(" · ")
  return (
    <div className="buy2">
      <span className="item2__ic">
        <Icon name="i-receipt" />
      </span>
      <div>
        <div className="buy2__title">{request.vendorName}</div>
        <div className="buy2__sub">{sub}</div>
      </div>
      <StatusBadge label={badge.label} tone={badge.tone} icon={badge.icon} />
    </div>
  )
}

/**
 * Carte « Achats payés en direct » d'une mission terminée (C11) : demandes payées ou reçues avec vendeur et montant,
 * estimation donnée à la publication (jamais additionnée), total payé aux vendeurs, mention des demandes signalées non
 * comptées et note « hors EduCash, non remboursable par EduCash ». Sans achat payé : rien.
 */
export function PaidPurchasesCard({ estimate, purchases }) {
  const rows = paidRequests(purchases)
  if (rows.length === 0) return null
  const paid = rows.reduce((sum, r) => sum + safeAmount(r.amount), 0)
  const reported = reportedAmount(purchases)
  const lines = []
  if (estimate) lines.push({ label: "Estimation donnée à la publication", value: estimate })
  if (reported > 0) lines.push({ label: "Signalés, non comptés", value: reported })
  return (
    <section className="card2 fup2__purchases fup2__paid" aria-label="Achats payés en direct">
      <div className="sec2">
        <h2 className="sec2__title">Achats payés en direct</h2>
        <StatusBadge label="Hors EduCash" icon="i-banknote" />
      </div>
      <div>
        {rows.map((request) => (
          <PaidPurchaseRow key={request.id} request={request} />
        ))}
      </div>
      <Lines rows={lines} total={{ label: "Total payé par vous aux vendeurs", value: paid }} />
      <p className="note2">
        <Icon name="i-info" />
        <span>
          Ces paiements sont allés de votre MoMo aux vendeurs. Ils n&apos;apparaissent pas dans votre portefeuille
          EduCash, ne supportent aucune commission et ne sont pas remboursables par EduCash.
          {reported > 0 ? " Une demande signalée n'est pas comptée tant que l'équipe EduCash l'examine." : ""}
        </span>
      </p>
    </section>
  )
}

/**
 * Carte des achats d'une mission terminée : « Achats payés en direct » quand au moins un achat est payé, sinon la carte
 * « Achats pour votre compte » existante (rendu inchangé sans achats payés ni données).
 */
export function DonePurchasesCard({ estimate, escrowed = false, purchases }) {
  if (paidRequests(purchases).length === 0) {
    return <PurchasesCard estimate={estimate} escrowed={escrowed} purchases={purchases} />
  }
  return <PaidPurchasesCard estimate={estimate} purchases={purchases} />
}

/**
 * Carte « Coût total » (C11, D7) : service plus achats payés en direct, jamais l'estimation. Les demandes signalées
 * n'y sont pas comptées et une ligne le dit. `costTotal` vient de `detail.purchases.costTotal` (mission terminée avec
 * au moins un achat payé, sinon null : rien n'est affiché). Le grand livre, la commission et le montant versé à
 * l'étudiant ne dépendent pas de cette carte.
 */
export function CostTotalCard({ purchases }) {
  const cost = purchases?.available === true ? purchases.costTotal : null
  if (!cost || safeAmount(cost.purchasesPaid) === 0) return null
  const reported = reportedAmount(purchases)
  const rows = [
    { label: "Service (via EduCash)", value: cost.service },
    { label: "Achats (en direct, hors EduCash)", value: cost.purchasesPaid },
  ]
  if (reported > 0) rows.push({ label: "Signalés, non comptés", value: reported })
  return (
    <section className="card2 fup2__cost" aria-label="Coût total">
      <div className="sec2">
        <h2 className="sec2__title">Coût total</h2>
      </div>
      <Lines rows={rows} total={{ label: "Coût total de la mission", value: cost.total }} />
    </section>
  )
}

/**
 * Reçu d'une mission terminée, lu au grand livre du client. « Prélevé » est la ligne `release` (brute,
 * commission incluse) et « Versé » est `release - commission` quand les deux lignes existent ; à défaut,
 * seul « Prélevé » est affiché (jamais de détail mêlant grand livre et calcul). Sans libération au grand livre (mission héritée), seul le budget est rappelé.
 */
function ServiceReceipt({ view, ledger, studentName, withPurchases = false }) {
  const title = withPurchases ? "Reçu du service" : "Reçu"
  const { receipt, split } = view
  const released = receipt.hasLedger && receipt.releasedGross > 0
  if (!released) {
    return (
      <section className="card2 fup2__money" aria-label={title}>
        <div className="sec2">
          <h2 className="sec2__title">{title}</h2>
        </div>
        <Lines rows={[{ label: "Budget de la mission", value: split.total }]} />
        <p className="note2">Le détail du paiement n&apos;est pas disponible pour cette mission.</p>
      </section>
    )
  }
  // Sans ligne de commission au grand livre, commission et versé ne sont pas connus : aucun détail issu d'une autre source.
  const detailed = receipt.student !== null
  const releasedAt = formatMoment(movementDate(ledger, "release"))
  return (
    <section className="card2 fup2__money" aria-label={title}>
      <div className="sec2">
        <h2 className="sec2__title">{title}</h2>
        <StatusBadge label="Payé" tone="succes" icon="i-check" />
      </div>
      {detailed ? (
        <Lines
          rows={[
            { label: "Prélevé du séquestre", value: receipt.releasedGross },
            { label: commissionLabel(), value: receipt.commission, sign: "debit" },
          ]}
          total={{ label: `Versé à ${studentName}`, value: receipt.student }}
        />
      ) : (
        <Lines rows={[{ label: "Prélevé du séquestre", value: receipt.releasedGross }]} />
      )}
      <div className="lines2">
        {releasedAt ? (
          <div className="lines2__row">
            <span>Libéré le</span>
            <b>{releasedAt}</b>
          </div>
        ) : null}
        <div className="lines2__row">
          <span>Moyen</span>
          <b>Portefeuille EduCash</b>
        </div>
      </div>
    </section>
  )
}

/**
 * Reçu du service suivi, si `purchases` (`detail.purchases`) a un coût total, de la carte « Coût total ». Sans achats
 * payés ou sans données, le rendu est celui du seul reçu du service.
 */
export function Receipt({ purchases, ...props }) {
  return (
    <>
      <ServiceReceipt {...props} />
      <CostTotalCard purchases={purchases} />
    </>
  )
}

export default Receipt
