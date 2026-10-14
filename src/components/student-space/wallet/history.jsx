"use client"

// @ds-screen RD-STUDENT-01
import { useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { ChipFilter } from "@/components/app-ui/chip-filter"
import { EmptyState } from "@/components/app-ui/empty-state"
import { splitAmount } from "@/components/app-ui/amount"
import { getStudentWalletMore } from "@/lib/actions/student-wallet.actions"
import { STUDENT_WALLET_FILTERS, studentWalletTxView } from "@/lib/student-space/student-wallet-tx"
import { studentMissionHref, studentWalletHref } from "@/lib/app/student-routes"

const BENIN_TZ = "Africa/Porto-Novo"

const ICONS = { release: "i-coins", withdrawal: "i-arrow-down", refund: "i-undo" }

// Précision grise du libellé de l'opération.
const HINTS = { withdrawal: "vers Mobile Money" }

/** Date courte « 08 oct. » (jour et mois au Bénin), "" si la date est absente ou invalide. */
export function txDate(iso) {
  if (typeof iso !== "string" || iso === "") return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: BENIN_TZ }).format(date)
}

function Row({ tx }) {
  const view = studentWalletTxView(tx.type)
  const money = splitAmount(tx.amount, view.direction)
  const hint = HINTS[tx.type]
  const date = txDate(tx.createdAt)
  return (
    <div className="e2-op e2-08-op" role="listitem">
      <span className="item2__ic">
        <Icon name={ICONS[tx.type] ?? "i-receipt"} />
      </span>
      <div>
        <div className="item2__title">
          {view.label}
          {hint ? ` ${hint}` : ""}
          {tx.missionTitle && tx.missionId ? (
            <>
              {" · "}
              <Link className="link" href={studentMissionHref(tx.missionId)}>
                {tx.missionTitle}
              </Link>
            </>
          ) : null}
        </div>
        {date ? <div className="item2__sub">{date}</div> : null}
      </div>
      <div className="e2-op__amount">
        <span className="e2-amount">
          {money.text}
          <small>{money.unit}</small>
        </span>
      </div>
    </div>
  )
}

/**
 * Historique en lignes avec les 4 filtres (liens `?filtre=`, jamais une action). Vue pure : les lignes déjà
 * chargées, le chargement et l'erreur de « Voir plus » viennent de l'extérieur.
 */
export function HistoryView({ filter, rows, hasMore, loading, error, onMore }) {
  const options = STUDENT_WALLET_FILTERS.map((f) => ({ value: f.id, label: f.label, href: studentWalletHref({ filtre: f.id }) }))
  return (
    <section className="list2" aria-label="Historique">
      <div className="list2__head">
        <h2 className="list2__title">Historique</h2>
      </div>
      <div className="list2__filters">
        <ChipFilter label="Filtrer l'historique" options={options} value={filter} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon="i-receipt"
          title={filter === "tout" ? "Aucun mouvement pour le moment" : "Aucun mouvement pour ce filtre"}
          text={
            filter === "tout"
              ? "Vos paiements reçus et vos retraits apparaîtront ici."
              : "Essayez un autre filtre pour voir le reste de votre historique."
          }
        />
      ) : (
        <div role="list">
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
      const result = await getStudentWalletMore({ filtre: filter, offset: rows.length })
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
