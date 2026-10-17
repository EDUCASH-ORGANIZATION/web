import { describe, it, expect } from "vitest"
import { clientConversationHref, clientNotificationsHref } from "./client-routes.js"

describe("notifications client", () => {
  it("page des notifications, seul le filtre non-lues est accepté", () => {
    expect(clientNotificationsHref()).toBe("/client/notifications")
    expect(clientNotificationsHref({ filtre: "non-lues" })).toBe("/client/notifications?filtre=non-lues")
    expect(clientNotificationsHref({ filtre: "https://evil.example" })).toBe("/client/notifications")
  })
})

describe("conversation client et demande de paiement d'achats", () => {
  const id = "33333333-3333-4333-8333-333333333333"

  it("adresses existantes inchangées sans option", () => {
    expect(clientConversationHref("m1")).toBe("/client/messages/m1")
    expect(clientConversationHref("m1", "s1")).toBe("/client/messages/m1?studentId=s1")
    expect(clientConversationHref("")).toBe("/client/messages")
    expect(clientConversationHref(undefined, "s1", { demande: id })).toBe("/client/messages")
  })

  it("porte la demande à faire défiler après l'étudiant", () => {
    expect(clientConversationHref("m1", "s1", { demande: id })).toBe(`/client/messages/m1?studentId=s1&demande=${id}`)
    expect(clientConversationHref("m1", undefined, { demande: id })).toBe(`/client/messages/m1?demande=${id}`)
  })

  it("ignore une demande qui n'est pas un identifiant", () => {
    for (const demande of ["", "1", "../x", `${id}&studentId=evil`, "https://evil.example", true, 12, null]) {
      expect(clientConversationHref("m1", "s1", { demande })).toBe("/client/messages/m1?studentId=s1")
    }
  })
})
