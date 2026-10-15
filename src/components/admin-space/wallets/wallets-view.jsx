// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { Stat } from "@/components/app-ui/stats"
import { formatAmount } from "@/lib/app/format"
import { adminTransactionsHref, adminUserHref, adminWalletsHref } from "@/lib/app/admin-routes"
import { formatTime } from "@/lib/admin-space/finance"
import { roleLabel } from "@/lib/admin-space/labels"
import { Pager } from "../finance/pager"

const plural = (n, one, many) => (n > 1 ? many : one)
const who = (item) => item.name || "Compte sans nom"

const ANOMALY_VIEW = {
  "negative-balance": { label: "Solde négatif", tone: "erreur" },
  "reserved-over-balance": { label: "Réservé supérieur au solde", tone: "alerte" },
}

function Header({ data }) {
  const count = data?.walletCount
  const at = data ? formatTime(data.now) : ""
  return (
    <div className="head2">
      <div>
        <h1 className="head2__title">Portefeuilles</h1>
        {data ? (
          <p className="head2__sub">
            Fonds détenus par EduCash pour ses utilisateurs
            {typeof count === "number" ? (
              <>
                {" "}
                · calculé sur <b>{count === 1 ? "le portefeuille" : `les ${count} portefeuilles`}</b>
                {at ? ` à ${at}` : ""}
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** Carte argent : la seule carte colorée de l'écran, trois montants calculés sur tous les portefeuilles. */
function Money({ data }) {
  const { totals, walletCount } = data
  return (
    <section className="money2 money2--split ad12-money" aria-label="Argent détenu pour les utilisateurs">
      <div className="money2__head">
        <span>Argent détenu pour les utilisateurs</span>
        <Link className="btn btn--blanc btn--sm" href={adminTransactionsHref()}>
          Journal des transactions
        </Link>
      </div>
      {totals.ok ? (
        <>
          <Stat
            label="En circulation"
            amount={totals.circulation}
            sub={typeof walletCount === "number" ? `${walletCount} ${plural(walletCount, "portefeuille", "portefeuilles")}` : undefined}
          />
          <Stat label="En séquestre" amount={totals.reserved} sub="Argent bloqué sur des missions" />
          <Stat label="Disponible" amount={totals.available} sub="Retirable par les titulaires" />
        </>
      ) : (
        <Stat label="Totaux" value="Indisponible" sub="Lecture impossible pour le moment" />
      )}
    </section>
  )
}

/** Anomalie la plus grave en tête (solde négatif d'abord), avec le lien vers la fiche du titulaire. */
function AnomalyCard({ anomalies }) {
  if (!anomalies.ok || anomalies.total === 0) return null
  const first = anomalies.items[0]
  if (!first) return null
  const negative = first.reason === "negative-balance"
  const others = anomalies.total - 1
  return (
    <section className="card2" aria-label="Anomalie">
      <span className="flag2">
        <Icon name="i-alert-triangle" />
        {anomalies.total > 1 ? `Anomalies · ${anomalies.total} portefeuilles` : "Anomalie · 1 portefeuille"}
      </span>
      <h2 className="hero2__title">
        {negative
          ? `${who(first)} : ${formatAmount(Math.abs(first.balance), { sign: "debit" })} de solde`
          : `${who(first)} : ${formatAmount(first.reserved)} réservés pour un solde de ${formatAmount(first.balance)}`}
      </h2>
      <p className="hero2__text">
        {negative
          ? "Le solde de ce portefeuille est négatif."
          : "L'argent réservé dépasse le solde de ce portefeuille."}
        {others > 0 ? ` ${others} ${plural(others, "autre portefeuille est", "autres portefeuilles sont")} aussi à vérifier.` : ""}
      </p>
      {first.userId ? (
        <div className="hero2__actions">
          <Link className="btn btn--dark" href={adminUserHref(first.userId)}>
            Ouvrir la fiche
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function Filters({ data }) {
  return (
    <form className="a2-filters" method="get" action={adminWalletsHref()} role="search" aria-label="Rechercher un portefeuille">
      <label className="search2">
        <Icon name="i-search" />
        <input type="search" name="q" defaultValue={data.q} placeholder="Nom du titulaire" aria-label="Rechercher un portefeuille" maxLength={60} />
      </label>
      <button type="submit" className="btn btn--secondary btn--sm">
        Rechercher
      </button>
      <span className="a2-filters__count">
        {data.total} {plural(data.total, "portefeuille", "portefeuilles")}
      </span>
    </form>
  )
}

function Table({ rows }) {
  return (
    <div className="ds-table-wrap">
      <table className="ds-table a2-tlist" aria-label="Portefeuilles">
        <thead>
          <tr>
            <th scope="col">Titulaire</th>
            <th scope="col">Rôle</th>
            <th scope="col" className="t-num">Solde</th>
            <th scope="col" className="t-num">En séquestre</th>
            <th scope="col" className="t-num">Disponible</th>
            <th scope="col">Fiche</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const anomaly = ANOMALY_VIEW[row.anomaly]
            return (
              <tr key={row.userId}>
                <td data-label="Titulaire">
                  {who(row)}
                  {anomaly ? (
                    <>
                      {" "}
                      <StatusBadge label={anomaly.label} tone={anomaly.tone} />
                    </>
                  ) : null}
                </td>
                <td data-label="Rôle">{roleLabel(row.role)}</td>
                <td data-label="Solde" className="t-num">
                  {formatAmount(row.balance, { sign: row.balance < 0 ? "debit" : "none" })}
                </td>
                <td data-label="En séquestre" className="t-num">
                  {formatAmount(row.reserved)}
                </td>
                <td data-label="Disponible" className="t-num">
                  {formatAmount(row.available, { sign: row.available < 0 ? "debit" : "none" })}
                </td>
                <td data-label="Fiche">
                  <Link className="link" href={adminUserHref(row.userId)} aria-label={`Fiche de ${who(row)}`}>
                    Fiche
                  </Link>
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
 * Portefeuilles (AD12), en lecture seule : la carte argent (seule carte colorée), l'anomalie éventuelle, puis la
 * liste paginée. Vue pure : `data` est la réponse de `getAdminWallets`, `error` son message d'erreur.
 */
export function WalletsView({ data, error }) {
  if (error || !data) {
    return (
      <div className="a2-12">
        <Header />
        <ErrorState titleAs="h2" title="Les portefeuilles n'ont pas pu être chargés" text={error || undefined} />
      </div>
    )
  }
  const href = (page) => adminWalletsHref({ q: data.q, page })
  return (
    <div className="a2-12">
      <Header data={data} />
      <Money data={data} />
      {data.anomalies.ok === false ? (
        <ErrorState compact title="Les anomalies n'ont pas pu être calculées" text="Les montants de la liste restent exacts." />
      ) : (
        <AnomalyCard anomalies={data.anomalies} />
      )}
      <Filters data={data} />
      {data.rows.length === 0 ? (
        data.q ? (
          <EmptyState
            compact
            icon="i-search"
            title="Aucun portefeuille ne correspond à cette recherche."
            action={{ href: adminWalletsHref(), label: "Voir tous les portefeuilles" }}
          />
        ) : (
          <EmptyState compact icon="i-wallet" title="Aucun portefeuille pour le moment." />
        )
      ) : (
        <Table rows={data.rows} />
      )}
      <Pager page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={href} />
    </div>
  )
}

export default WalletsView
