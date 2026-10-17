// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Stat, StatGroup } from "@/components/app-ui/stats"
import { formatAmount } from "@/lib/app/format"
import { adminUserHref, adminWithdrawalsHref } from "@/lib/app/admin-routes"
import { STUCK_WITHDRAWAL_WARNING, WITHDRAWAL_STATUS_VIEW, elapsedLabel, formatDateTime } from "@/lib/admin-space/finance"
import { Pager } from "./pager"

const plural = (n, one, many) => (n > 1 ? many : one)
const who = (row) => row.name || "Compte sans nom"

function Header({ total }) {
  return (
    <div className="head2">
      <div>
        <h1 className="head2__title">Retraits</h1>
        <p className="head2__sub">
          {typeof total === "number" ? <b>{total} {plural(total, "retrait", "retraits")}</b> : null}
          {typeof total === "number" ? " · " : ""}vers Mobile Money, par le prestataire de paiement
        </p>
      </div>
    </div>
  )
}

function Indicators({ stats, now }) {
  const { undebitedTransfer: stuck, reversed, created } = stats
  const oldest = stuck.oldestAt ? elapsedLabel(stuck.oldestAt, now) : ""
  const stuckSub =
    stuck.stuck > 0 ? `${formatAmount(stuck.amount)}${oldest ? ` · le plus ancien depuis ${oldest}` : ""}` : "Aucun retrait bloqué"
  return (
    <StatGroup label="Indicateurs des retraits">
      <Stat label="Débités sans virement créé" value={stuck.stuck} sub={stuckSub} />
      <Stat label="Virements créés" value={created} />
      <Stat label="Recrédités" value={reversed} sub="Portefeuille recrédité après un échec" />
    </StatGroup>
  )
}

function StuckCard({ row, now }) {
  const since = elapsedLabel(row.createdAt, now)
  return (
    <section className="card2" aria-label="Retrait le plus ancien à vérifier">
      <span className="flag2">
        <Icon name="i-clock" />
        {since ? `Attend depuis ${since}` : "En attente"}
      </span>
      <h2 className="hero2__title">
        Retrait de {who(row)} · {formatAmount(row.amount)}
      </h2>
      <p className="hero2__text">
        {`${row.operator} · demandé le ${formatDateTime(row.createdAt)} · aucune référence de paiement enregistrée : le portefeuille a été débité sans qu'un virement soit créé.`}
      </p>
      <div className="banner banner--alerte-doux" role="note">
        <Icon name="i-alert-triangle" className="ic" />
        <div className="banner__body">{STUCK_WITHDRAWAL_WARNING}</div>
      </div>
      {row.userId ? (
        <div className="hero2__actions">
          <Link className="btn btn--dark" href={adminUserHref(row.userId)}>
            Ouvrir la fiche
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function Table({ rows, now }) {
  return (
    <div className="ds-table-wrap">
      <table className="ds-table a2-tlist" aria-label="Retraits">
        <thead>
          <tr>
            <th scope="col">Titulaire</th>
            <th scope="col" className="t-num">Montant</th>
            <th scope="col">Opérateur</th>
            <th scope="col">Demandé</th>
            <th scope="col">Réf. paiement</th>
            <th scope="col">Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const view = WITHDRAWAL_STATUS_VIEW[row.status] ?? WITHDRAWAL_STATUS_VIEW.pending
            const since = elapsedLabel(row.createdAt, now)
            return (
              <tr key={row.id} className="a2-13-row">
                <td data-label="Titulaire">
                  {row.userId ? (
                    <Link className="link" href={adminUserHref(row.userId)}>
                      {who(row)}
                    </Link>
                  ) : (
                    who(row)
                  )}
                </td>
                <td data-label="Montant" className="t-num">
                  {formatAmount(row.amount, { sign: "debit" })}
                </td>
                <td data-label="Opérateur">{row.operator}</td>
                <td data-label="Demandé">
                  {formatDateTime(row.createdAt) || "-"}
                  {since ? ` · il y a ${since}` : ""}
                </td>
                <td data-label="Réf. paiement">{row.reference || "-"}</td>
                <td data-label="Statut">
                  <StatusBadge label={view.label} tone={view.tone} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * File des retraits (AD13), en lecture seule : aucune action, aucun mouvement d'argent. Vue pure : `data` est la
 * réponse de `listAdminWithdrawals`, `error` son message d'erreur.
 */
export function WithdrawalsView({ data, error, paymentsEnabled = false }) {
  if (error || !data) {
    return (
      <div className="a2-13">
        <Header />
        <ErrorState titleAs="h2" title="Les retraits n'ont pas pu être chargés" text={error || undefined} />
      </div>
    )
  }
  const now = new Date(data.now)
  const first = data.rows[0]
  const href = (page) => (page > 1 ? `${adminWithdrawalsHref()}?page=${page}` : adminWithdrawalsHref())
  return (
    <div className="a2-13">
      <Header total={data.total} />
      <Indicators stats={data.stats} now={now} />
      {data.page === 1 && first?.status === "stuck" ? <StuckCard row={first} now={now} /> : null}
      {data.rows.length === 0 ? (
        <EmptyState
          compact
          icon="i-arrow-up-right"
          title="Aucun retrait pour le moment."
          text={paymentsEnabled ? undefined : "Les paiements sont en cours d'activation : aucun retrait n'est attendu pour le moment."}
        />
      ) : (
        <Table rows={data.rows} now={now} />
      )}
      <Pager page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={href} />
      <p className="a2-note">
        <Icon name="i-info" />
        <span>{`Pour un retrait bloqué, contactez l'équipe technique. ${STUCK_WITHDRAWAL_WARNING}`}</span>
      </p>
    </div>
  )
}

export default WithdrawalsView
