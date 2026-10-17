// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/actions/mission.actions", () => ({
  confirmMission: vi.fn(async () => ({ success: true, amountStudent: 4400 })),
}))

const { ConfirmEndDialog } = await import("./confirm-end-dialog")
const { confirmMission } = await import("@/lib/actions/mission.actions")
const { escrowSplit } = await import("@/lib/app/money")

const purchases = (confirmWarning) => ({
  available: true,
  requests: [],
  totals: { count: 1, requested: 4000, paid: 0, pending: 4000, reported: 0 },
  confirmWarning,
  costTotal: null,
})

function open(p) {
  const onPaid = vi.fn()
  render(
    <ConfirmEndDialog
      open
      missionId="m1"
      title="Courses au marché"
      studentName="Ulrich"
      split={escrowSplit(5000)}
      since="9 oct."
      purchases={p}
      onClose={() => {}}
      onPaid={onPaid}
    />,
  )
  return onPaid
}

describe("C09 : l'avertissement des achats ne bloque ni ne double la libération", () => {
  it("demande en attente, case cochée : avertissement affiché, confirmMission appelé exactement une fois", async () => {
    confirmMission.mockClear()
    const onPaid = open(purchases({ show: true, pending: 1, reported: 0 }))
    expect(screen.getByRole("status").textContent).toContain("1 demande de paiement d'achats en attente")
    fireEvent.click(screen.getByRole("checkbox"))
    const release = screen.getByRole("button", { name: /Libérer le paiement/ })
    expect(release.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(release)
    })
    expect(confirmMission).toHaveBeenCalledTimes(1)
    expect(confirmMission).toHaveBeenCalledWith("m1")
    expect(onPaid).toHaveBeenCalledWith(4400)
  })

  it("case décochée : la libération reste verrouillée même avec un avertissement", async () => {
    confirmMission.mockClear()
    open(purchases({ show: true, pending: 1, reported: 0 }))
    const release = screen.getByRole("button", { name: /Libérer le paiement/ })
    expect(release.disabled).toBe(true)
    await act(async () => {
      fireEvent.click(release)
    })
    expect(confirmMission).not.toHaveBeenCalled()
  })
})
