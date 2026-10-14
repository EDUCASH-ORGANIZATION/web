import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/components/shared/toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/client-wallet.actions", () => ({ getClientWalletMoreTransactions: vi.fn() }))
vi.mock("@/components/client-space/wallet/deposit-dialog", () => ({ DepositDialog: () => <div data-modal="deposit" /> }))
vi.mock("@/components/client-space/wallet/withdraw-dialog", () => ({ WithdrawDialog: () => <div data-modal="withdraw" /> }))

const { WalletView } = await import("@/components/client-space/wallet/wallet-view")

const clientData = {
  wallet: { available: 15000, escrow: 5000, total: 20000 },
  funded: [],
  transactions: [],
  hasMore: false,
  filter: "tout",
  phone: "",
}

const renders = {
  client: (props) => renderToStaticMarkup(<WalletView data={clientData} today="2026-10-13" paymentsEnabled={false} {...props} />),
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
