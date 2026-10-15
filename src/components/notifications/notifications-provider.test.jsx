import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { NotificationsProvider, useNotifications } from "./notifications-provider"

function Reader() {
  const ctx = useNotifications()
  return <i>{ctx ? `${ctx.space}:${ctx.count}` : "aucun"}</i>
}

describe("NotificationsProvider", () => {
  it("fournit l'espace et le compteur initial", () => {
    const out = renderToStaticMarkup(
      <NotificationsProvider space="student" initialCount={4} actions={{}}>
        <Reader />
      </NotificationsProvider>,
    )
    expect(out).toBe("<i>student:4</i>")
  })

  it("compteur invalide : 0", () => {
    for (const value of [undefined, -2, "abc", NaN]) {
      const out = renderToStaticMarkup(
        <NotificationsProvider space="client" initialCount={value} actions={{}}>
          <Reader />
        </NotificationsProvider>,
      )
      expect(out).toBe("<i>client:0</i>")
    }
  })

  it("sans fournisseur : aucun contexte", () => {
    expect(renderToStaticMarkup(<Reader />)).toBe("<i>aucun</i>")
  })
})
