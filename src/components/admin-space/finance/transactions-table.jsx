"use client"
// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { useRef, useState } from "react"
import { Drawer } from "@/components/app-ui/drawer"
import { formatAmount } from "@/lib/app/format"
import { walletTxView } from "@/lib/app/wallet-tx"
import { adminMissionHref, adminUserHref } from "@/lib/app/admin-routes"
import { formatDateTime } from "@/lib/admin-space/finance"
import { transactionTypeLabel } from "@/lib/admin-space/labels"

const SIGN = { credit: "credit", debit: "debit", none: "none" }

/** Montant signé d'un mouvement, vu du titulaire : recharge et remboursement en plus, réservation et retrait en moins. */
export function movementAmount(row) {
  return formatAmount(row.amount, { sign: SIGN[walletTxView(row.type).direction] ?? "none" })
}

function typeText(row) {
  const label = transactionTypeLabel(row.type)
  return row.isReversal ? `${label} (annulation)` : label
}

/** Détail d'un mouvement (contenu du tiroir) : aucune note brute, aucun téléphone. */
export function TransactionDetail({ row }) {
  return (
    <dl className="a2-kv">
      <dt>Date</dt>
      <dd>{formatDateTime(row.createdAt) || "-"}</dd>
      <dt>Type</dt>
      <dd>{typeText(row)}</dd>
      <dt>Montant</dt>
      <dd>{movementAmount(row)}</dd>
      <dt>Solde après</dt>
      <dd>{row.balanceAfter === null ? "-" : formatAmount(row.balanceAfter)}</dd>
      <dt>Titulaire</dt>
      <dd>
        {row.userId ? <Link className="link" href={adminUserHref(row.userId)}>{row.name || "Compte sans nom"}</Link> : "-"}
      </dd>
      <dt>Mission</dt>
      <dd>{row.missionId ? <Link className="link" href={adminMissionHref(row.missionId)}>Voir la mission</Link> : "-"}</dd>
      <dt>Réf. paiement</dt>
      <dd>{row.reference || "-"}</dd>
      {row.operator ? (
        <>
          <dt>Opérateur</dt>
          <dd>{row.operator}</dd>
        </>
      ) : null}
      <dt>Mouvement</dt>
      <dd>{row.id}</dd>
    </dl>
  )
}

/**
 * Tableau des mouvements (AD11). Le détail s'ouvre dans un tiroir par un vrai bouton (clavier et lecteur d'écran),
 * jamais par un clic sur la ligne seule. Sous 768 px, chaque ligne devient une fiche (libellés en `data-label`).
 */
export function TransactionsTable({ rows }) {
  const [openId, setOpenId] = useState(null)
  const triggerRef = useRef(null)
  const open = rows.find((row) => row.id === openId) ?? null

  const close = () => {
    setOpenId(null)
    triggerRef.current?.focus()
  }

  return (
    <>
      <div className="ds-table-wrap">
        <table className="ds-table a2-tlist" aria-label="Mouvements du portefeuille">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Type</th>
              <th scope="col">Titulaire</th>
              <th scope="col" className="t-num">Montant</th>
              <th scope="col">Réf. paiement</th>
              <th scope="col">Détail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td data-label="Date">{formatDateTime(row.createdAt) || "-"}</td>
                <td data-label="Type">{typeText(row)}</td>
                <td data-label="Titulaire">{row.name || "Compte sans nom"}</td>
                <td data-label="Montant" className="t-num">{movementAmount(row)}</td>
                <td data-label="Réf. paiement">{row.reference || "-"}</td>
                <td data-label="Détail">
                  <button
                    type="button"
                    className="btn btn--soft btn--sm"
                    aria-label={`Détail du mouvement du ${formatDateTime(row.createdAt)}, ${typeText(row)}`}
                    onClick={(e) => {
                      triggerRef.current = e.currentTarget
                      setOpenId(row.id)
                    }}
                  >
                    Détail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer open={Boolean(open)} onClose={close} title={open ? `${typeText(open)} · ${movementAmount(open)}` : ""}>
        {open ? <TransactionDetail row={open} /> : null}
      </Drawer>
    </>
  )
}

export default TransactionsTable
