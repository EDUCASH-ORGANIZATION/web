import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { NotificationList } from "./notification-list"
import { groupNotifications } from "@/lib/notifications/catalog"

const NOW = new Date("2026-10-15T12:00:00Z")
const mk = (id, over = {}) => ({
  id,
  type: "application_received",
  title: `Titre ${id}`,
  body: "",
  createdAt: "2026-10-15T10:00:00Z",
  created_at: "2026-10-15T10:00:00Z",
  unread: true,
  icon: "i-file",
  href: `/client/missions/${id}`,
  actionLabel: "Voir la candidature",
  ...over,
})

describe("NotificationList", () => {
  const items = [mk("a"), mk("b"), mk("c", { createdAt: "2026-10-10T10:00:00Z", created_at: "2026-10-10T10:00:00Z", unread: false })]
  const groups = groupNotifications(items, NOW)

  it("liste groupée Aujourd'hui puis Plus tôt, en ul/li", () => {
    const out = renderToStaticMarkup(<NotificationList groups={groups} now={NOW} />)
    expect(out.indexOf("Aujourd&#x27;hui")).toBeGreaterThan(-1)
    expect(out.indexOf("Aujourd&#x27;hui")).toBeLessThan(out.indexOf("Plus tôt"))
    expect(out.match(/<ul /g)).toHaveLength(2)
    expect(out.match(/<li /g)).toHaveLength(3)
  })

  it("au plus un bouton encre : celui de primaryId", () => {
    const out = renderToStaticMarkup(<NotificationList groups={groups} now={NOW} primaryId="b" />)
    expect(out.match(/btn--dark/g)).toHaveLength(1)
    expect(out.indexOf("btn--dark")).toBeGreaterThan(out.indexOf("Titre a"))
    const none = renderToStaticMarkup(<NotificationList groups={groups} now={NOW} />)
    expect(none).not.toContain("btn--dark")
  })

  it("niveau de titre de groupe configurable", () => {
    expect(renderToStaticMarkup(<NotificationList groups={groups} now={NOW} headingAs="h3" />)).toContain("<h3 ")
    expect(renderToStaticMarkup(<NotificationList groups={groups} now={NOW} />)).toContain("<h2 ")
  })

  it("aucun groupe : rien à afficher", () => {
    expect(renderToStaticMarkup(<NotificationList groups={[]} now={NOW} />)).toBe('<div class="ntf-groups"></div>')
  })
})
