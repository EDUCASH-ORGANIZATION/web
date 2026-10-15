import { describe, it, expect } from "vitest"
import { clientNotificationsHref } from "./client-routes.js"

describe("notifications client", () => {
  it("page des notifications, seul le filtre non-lues est accepté", () => {
    expect(clientNotificationsHref()).toBe("/client/notifications")
    expect(clientNotificationsHref({ filtre: "non-lues" })).toBe("/client/notifications?filtre=non-lues")
    expect(clientNotificationsHref({ filtre: "https://evil.example" })).toBe("/client/notifications")
  })
})
