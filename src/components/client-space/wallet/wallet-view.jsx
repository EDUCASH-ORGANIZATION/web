"use client"

import { useState } from "react"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { MoneyCard } from "@/components/app-ui/money-card"
import { ErrorState } from "@/components/app-ui/state-block"
import { formatAmount } from "@/lib/app/format"
import { PAYMENTS_PENDING_COPY } from "@/lib/constants/payments"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"
import { FundedMissions, EscrowExplainer } from "./funded-missions"
import { History } from "./history"
import { DepositDialog } from "./deposit-dialog"
import { WithdrawDialog } from "./withdraw-dialog"
import { DepositReturnBanner } from "./deposit-return-banner"
import { ResumePublishBanner } from "./resume-publish-banner"

function plural(n, one, many) {
  return n > 1 ? many : one
}

function escrowNote(funded, escrow) {
  if (funded === null) return escrow > 0 ? "réservés à vos missions" : "aucune somme bloquée"
  if (funded.length === 0) return "aucune mission financée"
  return `bloqués pour ${funded.length} ${plural(funded.length, "mission", "missions")}`
}

function PausedNotice() {
  return (
    <div className="banner banner--info" role="status">
      <Icon name="i-info" />
      <div className="banner__body">
        <div className="banner__title">{PAYMENTS_PENDING_COPY.wallet.title}</div>
        {PAYMENTS_PENDING_COPY.wallet.client}
      </div>
    </div>
  )
}

/**
 * Portefeuille client (C14), avec les modales de recharge (C15) et de retrait (C16). Vue sans accès aux
 * données : tout vient de `getClientWalletPage` et des paramètres d'URL déjà validés par la page.
 * Recharger et Retirer n'existent que si `paymentsEnabled` (drapeau lu côté serveur) est vrai.
 * @param {{
 *   data?: import("@/lib/actions/client-wallet.actions").ClientWalletData,
 *   error?: string,
 *   today: string,
 *   paymentsEnabled: boolean,
 *   depositReturn?: { kind: "pending"|"cancelled"|"failed" } | null,
 *   recharge?: { open: boolean, suggestion: number|null },
 * }} props
 */
export function WalletView({ data, error, today, paymentsEnabled, depositReturn = null, recharge = { open: false, suggestion: null } }) {
  const [depositOpen, setDepositOpen] = useState(paymentsEnabled && recharge.open)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  if (error || !data) {
    return (
      <div className="page2">
        <ErrorState titleAs="h1" title="Impossible de charger votre portefeuille" />
      </div>
    )
  }

  const { wallet, funded, transactions, hasMore, filter, phone } = data
  const canWithdraw = wallet.available >= MIN_WITHDRAWAL_AMOUNT
  const actions = paymentsEnabled
    ? {
        action: (
          <button type="button" className="btn btn--blanc btn--sm" onClick={() => setDepositOpen(true)}>
            <Icon name="i-plus" />
            Recharger
          </button>
        ),
        secondaryAction: (
          <button
            type="button"
            className={canWithdraw ? "btn btn--ghost-blanc btn--sm" : "btn btn--ghost-blanc btn--sm is-disabled"}
            onClick={() => setWithdrawOpen(true)}
            disabled={!canWithdraw}
          >
            <Icon name="i-arrow-up-right" />
            Retirer
          </button>
        ),
        hint: canWithdraw ? undefined : `Retrait possible dès ${formatAmount(MIN_WITHDRAWAL_AMOUNT)} disponibles`,
        actionIn: "foot",
      }
    : {}

  return (
    <div className="page2">
      <PageHead date="Disponible et en séquestre" title="Portefeuille" />
      {paymentsEnabled ? <ResumePublishBanner mode="show" /> : null}
      {depositReturn ? <DepositReturnBanner kind={depositReturn.kind} paymentsEnabled={paymentsEnabled} /> : null}
      <div className="split2">
        <div className="col2">
          <MoneyCard
            title={`Votre argent · ${formatAmount(wallet.total)} au total`}
            available={wallet.available}
            escrow={wallet.escrow}
            availableNote={paymentsEnabled ? "pour publier ou retirer" : "sur votre portefeuille"}
            escrowNote={escrowNote(funded, wallet.escrow)}
            {...actions}
          />
          {paymentsEnabled ? null : <PausedNotice />}
          <History key={filter} filter={filter} transactions={transactions} hasMore={hasMore} />
        </div>
        <div className="col2">
          <FundedMissions missions={funded} escrow={wallet.escrow} today={today} paymentsEnabled={paymentsEnabled} />
          <EscrowExplainer />
        </div>
      </div>
      {paymentsEnabled ? (
        <>
          <DepositDialog
            open={depositOpen}
            onClose={() => setDepositOpen(false)}
            available={wallet.available}
            suggestion={recharge.suggestion}
          />
          <WithdrawDialog
            open={withdrawOpen}
            onClose={() => setWithdrawOpen(false)}
            available={wallet.available}
            escrow={wallet.escrow}
            phone={phone}
          />
        </>
      ) : null}
    </div>
  )
}

export default WalletView
