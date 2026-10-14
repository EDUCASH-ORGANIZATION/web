"use client"

// @ds-screen RD-STUDENT-01
import { useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { MoneyCard } from "@/components/app-ui/money-card"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { splitAmount } from "@/components/app-ui/amount"
import { formatAmount } from "@/lib/app/format"
import { studentMissionHref } from "@/lib/app/student-routes"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { PAYMENTS_PENDING_COPY } from "@/lib/constants/payments"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"
import { EarningsChart } from "./earnings-chart"
import { History } from "./history"
import { WithdrawDialog } from "./withdraw-dialog"

const HELP_HREF = "/contact?sujet=question"
const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

// Note sous le montant : pause des paiements, minimum manquant ou retrait possible.
function availableNote({ paymentsEnabled, available }) {
  if (!paymentsEnabled) {
    return (
      <>
        <b>{PAYMENTS_PENDING_COPY.wallet.title}.</b> {PAYMENTS_PENDING_COPY.wallet.student}
      </>
    )
  }
  if (available < MIN_WITHDRAWAL_AMOUNT) {
    return (
      <>
        <b>Il te manque {formatAmount(MIN_WITHDRAWAL_AMOUNT - available)}</b> pour retirer : le minimum est de {formatAmount(MIN_WITHDRAWAL_AMOUNT)}.
      </>
    )
  }
  return <>Retrait possible dès {formatAmount(MIN_WITHDRAWAL_AMOUNT)}.</>
}

function UnconfirmedWithdrawal({ withdrawal }) {
  return (
    <span className="e2-08-pending">
      <Icon name="i-clock" />
      <span>
        Retrait de <b>{formatAmount(withdrawal.amount)}</b> non confirmé. Si votre argent n&apos;est pas arrivé, <Link href={HELP_HREF}>contactez l&apos;aide</Link>.
      </span>
    </span>
  )
}

function ToComeList({ toCome }) {
  const total = splitAmount(toCome.total)
  return (
    <section className="list2" aria-label="À venir, en séquestre">
      <div className="list2__head">
        <h2 className="list2__title">
          À venir, en séquestre
          {toCome.missions.length > 0 ? <span>{`${total.text} ${total.unit} pour toi`}</span> : null}
        </h2>
        {toCome.missions.length > 0 ? (
          <span className="caption muted">Versé quand le client valide la fin de mission · ta part nette, après {COMMISSION_PERCENT} % de commission</span>
        ) : null}
      </div>
      {toCome.missions.length === 0 ? (
        <EmptyState compact icon="i-lock" title="Rien en séquestre pour le moment" text="Quand un client te retient pour une mission, ta part apparaît ici jusqu'à sa validation." />
      ) : (
        <div role="list">
          {toCome.missions.map((m) => {
            const net = splitAmount(m.net, "credit")
            return (
              <div className="e2-op e2-08-op" role="listitem" key={m.id}>
                <span className="item2__ic">
                  <Icon name="i-briefcase" />
                </span>
                <div>
                  <div className="item2__title">
                    <Link className="link" href={studentMissionHref(m.id)}>
                      {m.title}
                    </Link>
                  </div>
                  <div className="item2__sub">
                    {m.clientName} · <StatusBadge label="En cours" />
                  </div>
                </div>
                <div className="e2-op__amount">
                  <span className="e2-amount">
                    {net.text}
                    <small>{net.unit}</small>
                  </span>
                  <small>sur {formatAmount(m.budget)} bloqués</small>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/**
 * Portefeuille étudiant (E08) avec la modale de retrait (E09). Vue sans accès aux données : tout vient de
 * `getStudentWallet`, du préremplissage lu côté serveur et des paramètres d'URL déjà validés par la page.
 * Le retrait n'existe (bouton et modale) que si `paymentsEnabled` (drapeau lu côté serveur) est vrai ; le numéro
 * complet (`prefill.phone`) ne sert qu'à préremplir le champ de la modale.
 * @param {{
 *   data?: import("@/lib/actions/student-wallet.actions").StudentWalletData,
 *   error?: string,
 *   paymentsEnabled: boolean,
 *   prefill?: { phone: string },
 *   openWithdraw?: boolean,
 * }} props
 */
export function WalletView({ data, error, paymentsEnabled, prefill = { phone: "" }, openWithdraw = false }) {
  const available = data?.wallet.available ?? 0
  const canWithdraw = paymentsEnabled && available >= MIN_WITHDRAWAL_AMOUNT
  const [withdrawOpen, setWithdrawOpen] = useState(canWithdraw && openWithdraw)

  if (error || !data) {
    return (
      <div className="page2">
        <ErrorState titleAs="h1" title="Impossible de charger ton portefeuille" text="Le chargement a échoué. Ton argent n'est pas touché." />
      </div>
    )
  }

  const { gains, toCome, unconfirmedWithdrawal, transactions, hasMore, filter } = data
  const note = (
    <>
      {availableNote({ paymentsEnabled, available })}
      {unconfirmedWithdrawal ? <UnconfirmedWithdrawal withdrawal={unconfirmedWithdrawal} /> : null}
    </>
  )
  const action = canWithdraw ? (
    <button type="button" className="btn btn--blanc" onClick={() => setWithdrawOpen(true)}>
      <Icon name="i-arrow-down" />
      Retirer sur Mobile Money
    </button>
  ) : undefined

  return (
    <div className="page2">
      <PageHead date="Tes gains et tes retraits" title="Portefeuille" />
      <div className={gains ? "e2-08-top" : "e2-08-top e2-08-top--solo"}>
        <MoneyCard label="Disponible sur ton portefeuille" amount={available} note={note} action={action} />
        {gains ? <EarningsChart gains={gains} /> : null}
      </div>
      {toCome ? <ToComeList toCome={toCome} /> : null}
      <History key={filter} filter={filter} transactions={transactions} hasMore={hasMore} />
      {paymentsEnabled ? (
        <WithdrawDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} available={available} phone={prefill.phone} />
      ) : null}
    </div>
  )
}

export default WalletView
