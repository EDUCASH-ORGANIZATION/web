import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/components/shared/toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/client/deposit-modal", () => ({ DepositModal: () => <div data-modal="deposit" /> }))
vi.mock("@/components/client/withdraw-modal", () => ({ WithdrawModal: () => <div data-modal="withdraw" /> }))
vi.mock("@/components/student/withdraw-modal", () => ({ StudentWithdrawModal: () => <div data-modal="student-withdraw" /> }))

const { WalletClientShell } = await import("@/components/client/wallet-shell")
const { StudentWalletShell } = await import("@/components/student/wallet-shell")
const { DashboardWalletCard } = await import("@/components/client/dashboard-wallet-card")

const wallet = { balance: 20000, reserved: 5000 }
const stats = { totalDeposited: 20000, totalEarned: 8000, totalWithdrawn: 0, totalCommissions: 960 }

const renders = {
  client: (props) => renderToStaticMarkup(<WalletClientShell wallet={wallet} available={15000} transactions={[]} stats={stats} activeMissions={[]} {...props} />),
  student: (props) => renderToStaticMarkup(<StudentWalletShell wallet={wallet} available={15000} transactions={[]} stats={stats} completedMissions={[]} {...props} />),
  dashboard: (props) => renderToStaticMarkup(<DashboardWalletCard balance={20000} reserved={5000} available={15000} {...props} />),
}

describe.each(Object.keys(renders))("%s, paiements coupés (défaut)", (name) => {
  it("ne rend ni bouton de recharge ou de retrait ni modale", () => {
    const html = renders[name]()
    expect(html).not.toContain("data-modal")
    expect(html).not.toMatch(/>\s*(Recharger|Retirer|Retirer mes gains)\s*</)
    expect(html).toContain("Recharge et retrait en cours d&#x27;activation")
  })
})

describe.each(Object.keys(renders))("%s, paiements ouverts", (name) => {
  it("rend les modales et les boutons actuels", () => {
    const html = renders[name]({ paymentsEnabled: true })
    expect(html).toContain("data-modal")
    expect(html).not.toContain("en cours d&#x27;activation")
    expect(html).toMatch(/Retirer/)
  })
})
