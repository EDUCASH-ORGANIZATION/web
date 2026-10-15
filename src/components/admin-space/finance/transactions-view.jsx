// @ds-screen RD-ADMIN-01
import { Icon } from "@/components/design/icon"
import { Select } from "@/components/design/select"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { Stat, StatGroup } from "@/components/app-ui/stats"
import { WALLET_TRANSACTION_TYPES } from "@/lib/supabase/database.constants"
import { adminTransactionsHref } from "@/lib/app/admin-routes"
import { TRANSACTION_PERIODS } from "@/lib/admin-space/finance"
import { transactionTypeLabel } from "@/lib/admin-space/labels"
import { Pager } from "./pager"
import { TransactionsTable } from "./transactions-table"

const plural = (n, one, many) => (n > 1 ? many : one)

const TYPE_OPTIONS = [
  { value: "", label: "Tous les types" },
  ...WALLET_TRANSACTION_TYPES.map((type) => ({ value: type, label: transactionTypeLabel(type) })),
]
const PERIOD_OPTIONS = TRANSACTION_PERIODS.map((p) => ({ value: p.id, label: p.label }))

export function periodLabel(periode) {
  return TRANSACTION_PERIODS.find((p) => p.id === periode)?.label ?? ""
}

function Header({ data }) {
  return (
    <div className="head2">
      <div>
        <h1 className="head2__title">Transactions</h1>
        {data ? (
          <p className="head2__sub">
            <b>{data.total} {plural(data.total, "mouvement", "mouvements")}</b> · {periodLabel(data.periode).toLowerCase()}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Indicators({ data }) {
  const { deposits, commissions, released } = data.stats
  const label = periodLabel(data.periode)
  const unavailable = <Stat label="Indisponible" value="-" sub="Lecture impossible pour le moment" />
  return (
    <StatGroup label="Indicateurs de la période">
      {deposits.ok ? (
        <Stat
          label="Volume rechargé"
          amount={deposits.total}
          sub={`${deposits.count} ${plural(deposits.count, "opération", "opérations")} · ${label.toLowerCase()}`}
        />
      ) : (
        unavailable
      )}
      {commissions.ok ? <Stat label="Commissions" amount={commissions.total} sub={label} /> : unavailable}
      {released.ok ? <Stat label="Versé aux étudiants" amount={released.total} sub={label} /> : unavailable}
    </StatGroup>
  )
}

function Filters({ data }) {
  const { type: movementType, periode, q } = data
  return (
    <form className="a2-filters" method="get" action={adminTransactionsHref()} role="search" aria-label="Filtrer les mouvements">
      <label className="search2">
        <Icon name="i-search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Référence de paiement"
          aria-label="Rechercher par référence de paiement"
          maxLength={64}
        />
      </label>
      <Select variant="chip" name="type" icon="i-swap" defaultValue={movementType} options={TYPE_OPTIONS} aria-label="Type de mouvement" />
      <Select
        variant="chip"
        name="periode"
        icon="i-calendar"
        defaultValue={periode}
        options={PERIOD_OPTIONS}
        aria-label="Période"
      />
      <button type="submit" className="btn btn--secondary btn--sm">
        Filtrer
      </button>
    </form>
  )
}

function Empty({ data, paymentsEnabled }) {
  const filtered = data.q !== "" || data.type !== ""
  if (filtered) {
    return (
      <EmptyState
        compact
        icon="i-search"
        title="Aucun mouvement ne correspond à ces filtres."
        action={{ href: adminTransactionsHref({ periode: data.periode }), label: "Retirer les filtres" }}
      />
    )
  }
  return (
    <EmptyState
      compact
      icon="i-receipt"
      title="Aucun mouvement sur cette période."
      text={paymentsEnabled ? undefined : "Les paiements sont en cours d'activation : aucun mouvement n'est attendu pour le moment."}
    />
  )
}

/**
 * Journal des mouvements du portefeuille (AD11), en lecture seule. Vue pure : `data` est la réponse de
 * `listAdminTransactions`, `error` son message d'erreur.
 */
export function TransactionsView({ data, error, paymentsEnabled = false }) {
  if (error || !data) {
    return (
      <div className="a2-11">
        <Header />
        <ErrorState titleAs="h2" title="Les transactions n'ont pas pu être chargées" text={error || undefined} />
      </div>
    )
  }
  const href = (page) => adminTransactionsHref({ type: data.type, periode: data.periode, q: data.q, page })
  return (
    <div className="a2-11">
      <Header data={data} />
      <Indicators data={data} />
      <Filters data={data} />
      {data.rows.length === 0 ? <Empty data={data} paymentsEnabled={paymentsEnabled} /> : <TransactionsTable rows={data.rows} />}
      <Pager page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={href} />
      <p className="a2-note">
        <Icon name="i-info" />
        <span>{"Ce journal est en lecture seule : aucune action d'argent n'est possible depuis cet écran."}</span>
      </p>
    </div>
  )
}

export default TransactionsView
