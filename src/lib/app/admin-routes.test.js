import { describe, expect, it } from "vitest"
import {
  adminHomeHref,
  adminMissionHref,
  adminMissionsHref,
  adminTransactionsHref,
  adminUserHref,
  adminUsersHref,
  adminVerificationsHref,
  adminWalletsHref,
  adminWithdrawalsHref,
} from "./admin-routes"

const ID = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"

describe("fabriques d'URL admin", () => {
  it("accueil et retraits sont fixes", () => {
    expect(adminHomeHref()).toBe("/admin/dashboard")
    expect(adminWithdrawalsHref()).toBe("/admin/withdrawals")
  })

  it("vérifications : onglet par défaut et page 1 omis", () => {
    expect(adminVerificationsHref()).toBe("/admin/verifications")
    expect(adminVerificationsHref({ onglet: "a-examiner" })).toBe("/admin/verifications")
    expect(adminVerificationsHref({ onglet: "refuses", id: ID, page: 3 })).toBe(`/admin/verifications?onglet=refuses&id=${ID}&page=3`)
    expect(adminVerificationsHref({ page: 1 })).toBe("/admin/verifications")
    expect(adminVerificationsHref({ q: "Awa K", ecole: "UAC" })).toBe("/admin/verifications?q=Awa+K&ecole=UAC")
    expect(adminVerificationsHref({ delai: "plus-48h" })).toBe("/admin/verifications?delai=plus-48h")
    expect(adminVerificationsHref({ delai: "" })).toBe("/admin/verifications")
  })

  it("pages invalides ou non numériques : paramètre omis", () => {
    expect(adminUsersHref({ page: "abc" })).toBe("/admin/users")
    expect(adminUsersHref({ page: -4 })).toBe("/admin/users")
    expect(adminUsersHref({ page: "2.9" })).toBe("/admin/users?page=2")
  })

  it("utilisateurs : filtres dans l'ordre, valeurs vides omises", () => {
    expect(adminUsersHref({ q: "a&b=c", role: "student", verif: "", statut: "suspendu" })).toBe(
      "/admin/users?q=a%26b%3Dc&role=student&statut=suspendu",
    )
  })

  it("fiche utilisateur : identifiant encodé, repli sur la liste", () => {
    expect(adminUserHref(ID)).toBe(`/admin/users/${ID}`)
    expect(adminUserHref(ID, { onglet: "verification" })).toBe(`/admin/users/${ID}?onglet=verification`)
    expect(adminUserHref("a/b")).toBe("/admin/users/a%2Fb")
    expect(adminUserHref("")).toBe("/admin/users")
    expect(adminUserHref(undefined)).toBe("/admin/users")
  })

  it("missions, portefeuilles et transactions", () => {
    expect(adminMissionsHref({ statut: "a-confirmer", ville: "Cotonou", type: "Livraison", page: 2 })).toBe(
      "/admin/missions?statut=a-confirmer&ville=Cotonou&type=Livraison&page=2",
    )
    expect(adminMissionHref(ID)).toBe(`/admin/missions/${ID}`)
    expect(adminMissionHref(null)).toBe("/admin/missions")
    expect(adminWalletsHref()).toBe("/admin/wallets")
    expect(adminWalletsHref({ q: "Awa", page: 2 })).toBe("/admin/wallets?q=Awa&page=2")
    expect(adminTransactionsHref({ type: "commission", periode: "30j", q: "ref-1" })).toBe(
      "/admin/transactions?type=commission&periode=30j&q=ref-1",
    )
  })
})
