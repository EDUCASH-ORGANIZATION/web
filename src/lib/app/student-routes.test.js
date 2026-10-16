import { describe, it, expect } from "vitest"
import {
  studentHomeHref,
  studentMissionsHref,
  studentMissionHref,
  studentApplicationsHref,
  studentMessagesHref,
  studentConversationHref,
  studentWalletHref,
  studentNotificationsHref,
  studentProfileHref,
  studentProfileEditHref,
  studentVerifyHref,
  studentReviewHref,
  publicTalentHref,
} from "./student-routes.js"

describe("fabriques d'URL étudiant", () => {
  it("renvoie les routes fixes actuelles", () => {
    expect(studentHomeHref()).toBe("/dashboard")
    expect(studentMessagesHref()).toBe("/messages")
    expect(studentProfileHref()).toBe("/profile")
    expect(studentProfileEditHref()).toBe("/profile/edit")
    expect(studentVerifyHref()).toBe("/profile/verify")
  })

  it("studentMissionsHref omet les paramètres vides et la page 1", () => {
    expect(studentMissionsHref()).toBe("/student/missions")
    expect(studentMissionsHref({ q: "", type: undefined, page: 1 })).toBe("/student/missions")
    expect(studentMissionsHref({ q: "maths", page: 3 })).toBe("/student/missions?q=maths&page=3")
  })

  it("studentMissionsHref accepte une liste de villes et encode les valeurs", () => {
    const href = studentMissionsHref({ cities: ["Cotonou", "Porto-Novo"], q: "a&b" })
    const params = new URL(href, "http://x").searchParams
    expect(params.get("cities")).toBe("Cotonou,Porto-Novo")
    expect(params.get("q")).toBe("a&b")
    expect(studentMissionsHref({ cities: "Cotonou" })).toBe("/student/missions?cities=Cotonou")
    expect(studentMissionsHref({ cities: [] })).toBe("/student/missions")
  })

  it("studentMissionsHref ignore une page invalide", () => {
    expect(studentMissionsHref({ page: "abc" })).toBe("/student/missions")
    expect(studentMissionsHref({ page: 0 })).toBe("/student/missions")
  })

  it("studentMissionHref encode l'identifiant et gère postuler", () => {
    expect(studentMissionHref("abc")).toBe("/student/missions/abc")
    expect(studentMissionHref("a/b")).toBe("/student/missions/a%2Fb")
    expect(studentMissionHref("abc", { postuler: true })).toBe("/student/missions/abc?postuler=1")
    expect(studentMissionHref("abc", { postuler: false })).toBe("/student/missions/abc")
    expect(studentMissionHref("abc", { terminer: true })).toBe("/student/missions/abc?terminer=1")
    expect(studentMissionHref("abc", { terminer: false })).toBe("/student/missions/abc")
    expect(studentMissionHref("abc", { postuler: true, terminer: true })).toBe("/student/missions/abc?postuler=1&terminer=1")
    expect(studentMissionHref("")).toBe("/student/missions")
    expect(studentMissionHref(null)).toBe("/student/missions")
  })

  it("studentApplicationsHref porte l'onglet", () => {
    expect(studentApplicationsHref()).toBe("/applications")
    expect(studentApplicationsHref({ onglet: "en-cours" })).toBe("/applications?onglet=en-cours")
  })

  it("studentConversationHref retombe sur la liste sans identifiant", () => {
    expect(studentConversationHref("m1")).toBe("/messages/m1")
    expect(studentConversationHref(undefined)).toBe("/messages")
  })

  it("studentConversationHref porte les drapeaux d'achats valides et ignore les autres", () => {
    const id = "33333333-3333-4333-8333-333333333333"
    expect(studentConversationHref("m1", { achat: "nouveau" })).toBe("/messages/m1?achat=nouveau")
    expect(studentConversationHref("m1", { achat: true })).toBe("/messages/m1?achat=nouveau")
    expect(studentConversationHref("m1", { demande: id })).toBe(`/messages/m1?demande=${id}`)
    expect(studentConversationHref("m1", { achat: "nouveau", demande: id })).toBe(`/messages/m1?achat=nouveau&demande=${id}`)
    expect(studentConversationHref("m1", { achat: "oui", demande: "../x" })).toBe("/messages/m1")
    expect(studentConversationHref("m1", { achat: false, demande: "" })).toBe("/messages/m1")
    expect(studentConversationHref("m1", { demande: `${id}&x=1` })).toBe("/messages/m1")
    expect(studentConversationHref("m1", {})).toBe("/messages/m1")
    expect(studentConversationHref(undefined, { achat: "nouveau" })).toBe("/messages")
  })

  it("studentWalletHref omet le filtre par défaut et gère retrait", () => {
    expect(studentWalletHref()).toBe("/wallet")
    expect(studentWalletHref({ filtre: "tout" })).toBe("/wallet")
    expect(studentWalletHref({ filtre: "retraits" })).toBe("/wallet?filtre=retraits")
    expect(studentWalletHref({ retrait: true })).toBe("/wallet?retrait=1")
    expect(studentWalletHref({ filtre: "paiements", retrait: true })).toBe("/wallet?filtre=paiements&retrait=1")
  })

  it("studentReviewHref pointe vers /student/review, identifiant encodé", () => {
    expect(studentReviewHref("m1")).toBe("/student/review/m1")
    expect(studentReviewHref("a/b?c")).toBe("/student/review/a%2Fb%3Fc")
    expect(studentReviewHref("")).toBe("/applications")
  })

  it("publicTalentHref pointe vers la vitrine", () => {
    expect(publicTalentHref("u1")).toBe("/talents/u1")
    expect(publicTalentHref()).toBe("/talents")
  })
})

describe("notifications étudiant", () => {
  it("page des notifications, seul le filtre non-lues est accepté", () => {
    expect(studentNotificationsHref()).toBe("/student/notifications")
    expect(studentNotificationsHref({ filtre: "non-lues" })).toBe("/student/notifications?filtre=non-lues")
    expect(studentNotificationsHref({ filtre: "x" })).toBe("/student/notifications")
  })
})
