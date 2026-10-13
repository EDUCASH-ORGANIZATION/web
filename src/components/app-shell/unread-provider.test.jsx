import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const hook = vi.fn((_id, initial) => initial + 1)
vi.mock("@/hooks/use-unread-count", () => ({ useUnreadCount: (...args) => hook(...args) }))

const { UnreadProvider, useUnread } = await import("./unread-provider")

function Reader({ name }) {
  return <i data-name={name}>{useUnread()}</i>
}

describe("UnreadProvider", () => {
  it("appelle le hook une seule fois et partage le compteur avec tous les lecteurs", () => {
    hook.mockClear()
    const out = renderToStaticMarkup(
      <UnreadProvider userId="u1" initialCount={4}>
        <Reader name="a" />
        <Reader name="b" />
      </UnreadProvider>,
    )
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith("u1", 4)
    expect(out).toBe('<i data-name="a">5</i><i data-name="b">5</i>')
  })

  it("sans fournisseur, le compteur vaut 0", () => {
    expect(renderToStaticMarkup(<Reader name="x" />)).toBe('<i data-name="x">0</i>')
  })
})
