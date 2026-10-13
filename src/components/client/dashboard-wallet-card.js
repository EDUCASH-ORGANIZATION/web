"use client"

import { useState } from "react"
import { WalletCard } from "@/components/shared/wallet-card"
import { DepositModal } from "@/components/client/deposit-modal"
import { WithdrawModal } from "@/components/client/withdraw-modal"
import { useToast } from "@/components/shared/toaster"

export function DashboardWalletCard({ balance, reserved, available, paymentsEnabled = false }) {
  const [depositOpen,  setDepositOpen]  = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const { toast } = useToast()

  return (
    <>
      <WalletCard
        balance={balance}
        reserved={reserved}
        available={available}
        role="client"
        showActions
        paymentsEnabled={paymentsEnabled}
        onDeposit={() => setDepositOpen(true)}
        onWithdraw={() => setWithdrawOpen(true)}
      />
      {paymentsEnabled && (
        <>
          <DepositModal
            isOpen={depositOpen}
            onClose={() => setDepositOpen(false)}
            currentBalance={available}
          />
          <WithdrawModal
            isOpen={withdrawOpen}
            onClose={() => setWithdrawOpen(false)}
            available={available}
            onSuccess={(msg) => toast({ message: msg, type: "success" })}
          />
        </>
      )}
    </>
  )
}
