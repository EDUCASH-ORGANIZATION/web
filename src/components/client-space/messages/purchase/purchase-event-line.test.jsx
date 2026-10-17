// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import "@/qa/dom/setup.test.support"
import { render, screen } from "@testing-library/react"
import { PurchaseEventLine } from "./purchase-event-line"
import { purchaseMessageContent } from "@/lib/purchases/requests"

describe("PurchaseEventLine", () => {
  it("affiche le texte fixe du serveur dans une ligne système", () => {
    const content = purchaseMessageContent("purchase_event", 2, "paid")
    const { container } = render(<PurchaseEventLine content={content} />)
    expect(screen.getByText(content)).toBeTruthy()
    expect(container.querySelector(".msg-system")).not.toBeNull()
  })

  it("n'interprète pas le contenu : le HTML est affiché comme du texte", () => {
    const { container } = render(<PurchaseEventLine content={'<img src=x onerror="alert(1)">'} />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain("<img")
  })

  it("n'affiche rien sans contenu valide", () => {
    for (const content of [undefined, null, "", "   ", 42, {}]) {
      const { container, unmount } = render(<PurchaseEventLine content={content} />)
      expect(container.innerHTML).toBe("")
      unmount()
    }
  })
})
