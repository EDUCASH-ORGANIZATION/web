"use client"

import { useState } from "react"
import Link from "next/link"
import { ChipFilter } from "@/components/app-ui/chip-filter"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { EmptyState } from "@/components/app-ui/empty-state"
import { splitAmount } from "@/components/app-ui/amount"
import { getClientWalletMoreTransactions } from "@/lib/actions/client-wallet.actions"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { WALLET_FILTERS, walletTxView } from "@/lib/app/wallet-tx"
import { clientMissionHref, clientWalletHref } from "@/lib/app/client-routes"

const BENIN_TZ = "Africa/Porto-Novo"
const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

// Précision grise à droite du libellé de l'opération.
const HINTS = {
  deposit: "Mobile Money",
  reserve: "bloqué à la publication",
  release: "prélevé du séquestre (commission incluse)",
  commission: `${COMMISSION_PERCENT} % du budget`,
  refund: "mission annulée",
  withdrawal: "vers Mobile Money",
}

// Mouvements sans mission : la ligne le dit plutôt que de rester vide.
const NO_MISSION = new Set(["deposit", "withdrawal"])

/** Date courte « 08 oct. » (jour et mois au Bénin), "" si la date est absente ou invalide. */
export function txDate(iso) {
  if (typeof iso !== "string" || iso === "") return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: BENIN_TZ }).format(date)
}

function Row({ tx }) {
  const view = walletTxView(tx.type)
  const money = splitAmount(tx.amount, view.direction)
  const hint = HINTS[tx.type]
  return (
    <div className="tx2" role="listitem">
      <span className="tx2__date">{txDate(tx.createdAt)}</span>
      <div className="tx2__main">
        <div className="tx2__title">
          {view.label}
          {hint ? <span className="tx2__hint"> · {hint}</span> : null}
        </div>
        {tx.missionTitle && tx.missionId ? (
          <div className="tx2__sub">
            <Link href={clientMissionHref(tx.missionId)}>{tx.missionTitle}</Link>
          </div>
        ) : NO_MISSION.has(tx.type) ? (
          <div className="tx2__sub">Aucune mission</div>
        ) : null}
      </div>
      <span className="tx2__badge">{tx.type === "reserve" ? <StatusBadge label="En séquestre" icon="i-lock" /> : null}</span>
      <span className={view.direction === "credit" ? "tx2__amt tx2__amt--plus" : "tx2__amt"}>
        {money.text}
        <small>{money.unit}</small>
      </span>
    </div>
  )
}

/**
 * Historique en lignes avec les 7 filtres (liens `?filtre=`). Vue pure : les lignes déjà chargées, le
 * chargement et l'erreur de « Voir plus » viennent de l'extérieur.
 */
export function HistoryView({ filter, rows, hasMore, loading, error, onMore }) {
  const options = WALLET_FILTERS.map((f) => ({ value: f.id, label: f.label, href: clientWalletHref({ filtre: f.id }) }))
  return (
    <section className="list2" aria-label="Historique">
      <div className="list2__head">
        <h2 className="list2__title">Historique</h2>
      </div>
      <div className="filters2">
        <ChipFilter label="Filtrer l'historique" options={options} value={filter} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon="i-receipt"
          title={filter === "tout" ? "Aucun mouvement pour le moment" : "Aucun mouvement pour ce filtre"}
          text={
            filter === "tout"
              ? "Vos recharges, réservations et remboursements apparaîtront ici."
              : "Essayez un autre filtre pour voir le reste de votre historique."
          }
        />
      ) : (
        <div role="list" className="txs2">
          {rows.map((tx) => (
            <Row key={tx.id} tx={tx} />
          ))}
        </div>
      )}
      {error ? (
        <div className="list2__foot" role="alert">
          <span>{error}</span>
        </div>
      ) : null}
      {hasMore ? (
        <div className="list2__foot">
          <span>{rows.length} mouvements affichés</span>
          <button type="button" className="btn btn--soft btn--sm" onClick={onMore} disabled={loading} aria-busy={loading ? "true" : undefined}>
            {loading ? "Chargement" : "Voir plus"}
          </button>
        </div>
      ) : null}
    </section>
  )
}

/**
 * Historique du filtre courant. À rendre avec `key={filter}` : un changement de filtre repart de la
 * première page fournie par le serveur.
 * @param {{ filter: string, transactions: Array<object>, hasMore: boolean }} props
 */
export function History({ filter, transactions, hasMore: initialHasMore }) {
  const [rows, setRows] = useState(transactions)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function more() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await getClientWalletMoreTransactions({ filtre: filter, offset: rows.length })
      if (result?.error) {
        setError(result.error)
        return
      }
      // Dédoublonnage : un mouvement ajouté entre deux pages décale le découpage.
      const known = new Set(rows.map((r) => r.id))
      setRows([...rows, ...result.transactions.filter((t) => !known.has(t.id))])
      setHasMore(result.hasMore)
    } catch {
      setError("Impossible de charger les mouvements suivants.")
    } finally {
      setLoading(false)
    }
  }

  return <HistoryView filter={filter} rows={rows} hasMore={hasMore} loading={loading} error={error} onMore={more} />
}

export default History
