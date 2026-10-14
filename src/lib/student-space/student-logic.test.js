import { describe, it, expect } from "vitest"
import { verificationView, verificationFromRows, EXPIRING_DAYS } from "./verification-status.js"
import { parseExploreParams, escapeLike, notExpiredFilter } from "./explore-query.js"
import {
  APPLICATION_TABS,
  applicationTab,
  groupApplications,
  defaultApplicationTab,
} from "./applications-tabs.js"
import {
  STUDENT_WALLET_FILTERS,
  parseStudentWalletFilter,
  studentWalletFilterTypes,
  filterStudentWalletTransactions,
  studentWalletTxView,
} from "./student-wallet-tx.js"
import { BUDGET_RANGES, SORTS, SEARCH_MAX_LENGTH, MISSIONS_PAGE_SIZE } from "../constants/missions.js"

const TODAY = "2026-10-14"

describe("verificationView", () => {
  it("carte jamais envoyée : non, avec action d'envoi", () => {
    const v = verificationView({ isVerified: false, hasCard: false }, TODAY)
    expect(v.key).toBe("not_submitted")
    expect(v.canApply).toBe(false)
    expect(v.action).toEqual({ label: "Envoyer ma carte", href: "/profile/verify" })
  })

  it("carte en cours d'examen : candidature permise, aucune action", () => {
    const v = verificationView({ isVerified: false, hasCard: true, submittedAt: "2026-10-10T08:00:00Z" }, TODAY)
    expect(v.key).toBe("pending")
    expect(v.canApply).toBe(true)
    expect(v.action).toBeNull()
  })

  it("carte refusée : non, avec renvoi (le motif prime sur la présence de la carte)", () => {
    const v = verificationView({ isVerified: false, hasCard: true, rejectionReason: "Photo floue" }, TODAY)
    expect(v.key).toBe("rejected")
    expect(v.canApply).toBe(false)
    expect(v.action.label).toBe("Renvoyer ma carte")
  })

  it("vérifié sans échéance ou loin de l'échéance : permis, aucune action", () => {
    expect(verificationView({ isVerified: true, verifiedUntil: null }, TODAY)).toMatchObject({
      key: "verified", canApply: true, action: null, daysLeft: null,
    })
    expect(verificationView({ isVerified: true, verifiedUntil: "2027-06-01" }, TODAY)).toMatchObject({
      key: "verified", canApply: true, action: null,
    })
  })

  it("seuil de 30 jours : 31 jours vérifié, 30 jours expire bientôt", () => {
    expect(EXPIRING_DAYS).toBe(30)
    expect(verificationView({ isVerified: true, verifiedUntil: "2026-11-14" }, TODAY).key).toBe("verified")
    const v = verificationView({ isVerified: true, verifiedUntil: "2026-11-13" }, TODAY)
    expect(v).toMatchObject({ key: "expiring", canApply: true, daysLeft: 30 })
    expect(v.action.label).toBe("Renouveler mon badge")
  })

  it("échéance aujourd'hui : expire bientôt ; expiré la veille : refus", () => {
    expect(verificationView({ isVerified: true, verifiedUntil: TODAY }, TODAY)).toMatchObject({
      key: "expiring", canApply: true, daysLeft: 0,
    })
    const v = verificationView({ isVerified: true, verifiedUntil: "2026-10-13" }, TODAY)
    expect(v).toMatchObject({ key: "expired", canApply: false, daysLeft: -1 })
    expect(v.action.label).toBe("Renouveler mon badge")
  })

  it("un horodatage est converti à la date du Bénin (UTC+1)", () => {
    // 23:30 UTC le 13 octobre = 00:30 le 14 octobre au Bénin : encore valable aujourd'hui.
    expect(verificationView({ isVerified: true, verifiedUntil: "2026-10-13T23:30:00Z" }, TODAY).key).toBe("expiring")
    // 22:30 UTC le 13 octobre = 23:30 le 13 octobre au Bénin : expiré.
    expect(verificationView({ isVerified: true, verifiedUntil: "2026-10-13T22:30:00Z" }, TODAY).key).toBe("expired")
  })

  it("la date du jour par défaut est celle du Bénin", () => {
    expect(verificationView({ isVerified: true, verifiedUntil: "2999-01-01" }).key).toBe("verified")
    expect(verificationView({ isVerified: true, verifiedUntil: "2000-01-01" }).key).toBe("expired")
  })

  it("une échéance illisible donne un badge expiré, une échéance absente reste sans fin", () => {
    expect(verificationView({ isVerified: true, verifiedUntil: "n'importe quoi" }, TODAY)).toMatchObject({
      key: "expired",
      canApply: false,
      daysLeft: null,
    })
    expect(verificationView({ isVerified: true, verifiedUntil: null }, TODAY).key).toBe("verified")
    expect(verificationView({ isVerified: true, verifiedUntil: "" }, TODAY).key).toBe("verified")
  })

  it("verificationFromRows calcule le statut à partir des lignes serveur", () => {
    expect(verificationFromRows({ is_verified: false, rejection_reason: "flou" }, { card_url: "u/c.jpg" }).key).toBe("rejected")
    expect(verificationFromRows({ is_verified: false }, { card_url: "u/c.jpg" }).key).toBe("pending")
    expect(verificationFromRows(null, null).key).toBe("not_submitted")
    expect(verificationFromRows({ is_verified: true, verified_until: "2999-01-01" }, null).key).toBe("verified")
  })

  it("les 6 statuts existent, canApply suit la décision D2 et les libellés sont tutoyables", () => {
    const states = [
      [{}, "not_submitted", false],
      [{ hasCard: true }, "pending", true],
      [{ isVerified: true }, "verified", true],
      [{ isVerified: true, verifiedUntil: "2026-10-20" }, "expiring", true],
      [{ isVerified: true, verifiedUntil: "2026-10-01" }, "expired", false],
      [{ rejectionReason: "x" }, "rejected", false],
    ]
    for (const [state, key, canApply] of states) {
      const v = verificationView(state, TODAY)
      expect(v.key).toBe(key)
      expect(v.canApply).toBe(canApply)
      expect(v.label).toBeTruthy()
    }
  })

  it("ne renvoie jamais le motif de refus ni la date de dépôt", () => {
    const v = verificationView({ rejectionReason: "secret", submittedAt: "2026-10-01T00:00:00Z", hasCard: true }, TODAY)
    expect(JSON.stringify(v)).not.toContain("secret")
    expect(JSON.stringify(v)).not.toContain("2026-10-01")
  })
})

describe("parseExploreParams", () => {
  it("valeurs par défaut sur une URL vide ou absente", () => {
    for (const input of [{}, undefined, null]) {
      expect(parseExploreParams(input)).toMatchObject({
        q: "", type: "", cities: [], urgency: "", budget: "", sort: "", page: 1,
        likePattern: null, urgencyValue: null, budgetRange: null, hasFilter: false,
        order: { column: "created_at", ascending: false },
        range: { from: 0, to: MISSIONS_PAGE_SIZE - 1 },
      })
    }
  })

  it("refuse les valeurs hors liste", () => {
    const p = parseExploreParams({
      type: "Piratage", cities: "Paris,Londres", urgency: "critique", budget: "1-2", sort: "hack", page: "abc",
    })
    expect(p).toMatchObject({ type: "", cities: [], urgency: "", budget: "", sort: "", page: 1, hasFilter: false })
  })

  it("accepte les valeurs de la liste", () => {
    const p = parseExploreParams({
      type: "Babysitting", cities: "Cotonou,Porto-Novo,Cotonou", urgency: "urgent", budget: "5000-15000", sort: "prix-desc", page: "3",
    })
    expect(p).toMatchObject({
      type: "Babysitting", cities: ["Cotonou", "Porto-Novo"], urgency: "urgent", urgencyValue: "high",
      budget: "5000-15000", budgetRange: { min: 5000, max: 15000 }, sort: "prix-desc", page: 3, hasFilter: true,
      order: { column: "budget", ascending: false },
      range: { from: 2 * MISSIONS_PAGE_SIZE, to: 3 * MISSIONS_PAGE_SIZE - 1 },
    })
  })

  it("tranche sans borne haute et tri croissant", () => {
    const p = parseExploreParams({ budget: "30000+", sort: "prix" })
    expect(p.budgetRange).toEqual({ min: 30000 })
    expect(p.order).toEqual({ column: "budget", ascending: true })
  })

  it("couvre toutes les tranches et tous les tris de la vitrine", () => {
    for (const r of BUDGET_RANGES) expect(parseExploreParams({ budget: r.id }).budget).toBe(r.id)
    for (const s of SORTS) expect(parseExploreParams({ sort: s.id }).sort).toBe(s.id)
  })

  it("accepte les anciennes valeurs de l'URL étudiante", () => {
    expect(parseExploreParams({ urgency: "high" }).urgency).toBe("urgent")
    expect(parseExploreParams({ sort: "budget_asc" }).sort).toBe("prix")
    expect(parseExploreParams({ sort: "budget_desc" }).sort).toBe("prix-desc")
    expect(parseExploreParams({ sort: "recent" }).sort).toBe("")
  })

  it("prend la première valeur d'un paramètre répété et ignore les non-chaînes", () => {
    expect(parseExploreParams({ type: ["Babysitting", "Autre"] }).type).toBe("Babysitting")
    expect(parseExploreParams({ q: 42, page: {} })).toMatchObject({ q: "", page: 1 })
  })

  it("borne la recherche et la page", () => {
    expect(parseExploreParams({ q: "x".repeat(SEARCH_MAX_LENGTH + 50) }).q).toHaveLength(SEARCH_MAX_LENGTH)
    expect(parseExploreParams({ q: "  maths  " }).q).toBe("maths")
    expect(parseExploreParams({ page: "0" }).page).toBe(1)
    expect(parseExploreParams({ page: "-4" }).page).toBe(1)
    expect(parseExploreParams({ page: "999999999" }).page).toBe(100000)
  })

  it("échappe %, _, virgule, parenthèses et astérisque dans le motif", () => {
    // `*` reste tel quel : PostgREST le convertit en `%` même échappé (joker accepté, pas une faille).
    expect(escapeLike("100%_a,b(c)*d\\e")).toBe("100\\%\\_a\\,b\\(c\\)*d\\\\e")
    expect(parseExploreParams({ q: "50%,_(x)" }).likePattern).toBe("%50\\%\\,\\_\\(x\\)%")
  })

  it("filtre « non expirées » à la date donnée", () => {
    expect(notExpiredFilter("2026-10-14")).toBe("deadline.is.null,deadline.gte.2026-10-14")
    expect(notExpiredFilter()).toMatch(/^deadline\.is\.null,deadline\.gte\.\d{4}-\d{2}-\d{2}$/)
  })
})

describe("onglets de candidatures", () => {
  const app = (status, missionStatus) => ({ status, missions: missionStatus ? { status: missionStatus } : null })

  it("classe par statut de candidature et de mission", () => {
    expect(applicationTab(app("pending", "open"))).toBe("en-attente")
    expect(applicationTab(app("pending"))).toBe("en-attente")
    expect(applicationTab(app("accepted", "in_progress"))).toBe("en-cours")
    expect(applicationTab(app("accepted", "open"))).toBe("en-cours")
    expect(applicationTab(app("accepted", "done"))).toBe("terminees")
    expect(applicationTab(app("accepted", "cancelled"))).toBe("non-retenues")
    expect(applicationTab(app("rejected", "open"))).toBe("non-retenues")
    expect(applicationTab(app("pending", "in_progress"))).toBe("non-retenues")
    expect(applicationTab(app("pending", "cancelled"))).toBe("non-retenues")
  })

  it("une candidature acceptée dont un autre étudiant est retenu va dans « Non retenues » (sans dépendre de la RLS)", () => {
    const withSelected = (status, missionStatus, selected) => ({ status, missions: { status: missionStatus, selected_student_id: selected } })
    expect(applicationTab(withSelected("accepted", "in_progress", "other"), "me")).toBe("non-retenues")
    expect(applicationTab(withSelected("accepted", "done", "other"), "me")).toBe("non-retenues")
    expect(applicationTab(withSelected("accepted", "in_progress", "me"), "me")).toBe("en-cours")
    expect(applicationTab(withSelected("accepted", "done", "me"), "me")).toBe("terminees")
    expect(applicationTab(withSelected("accepted", "in_progress", null), "me")).toBe("en-cours")
    expect(applicationTab(withSelected("accepted", "in_progress", "other"))).toBe("en-cours")
  })

  it("expose 4 onglets aux identifiants de l'URL", () => {
    expect(APPLICATION_TABS.map((t) => t.id)).toEqual(["en-attente", "en-cours", "terminees", "non-retenues"])
  })

  it("répartit et compte, sans perdre de candidature", () => {
    const list = [app("pending", "open"), app("pending", "open"), app("accepted", "done"), app("rejected", "open")]
    const { groups, counts } = groupApplications(list)
    expect(counts).toEqual({ "en-attente": 2, "en-cours": 0, terminees: 1, "non-retenues": 1 })
    expect(Object.values(groups).flat()).toHaveLength(list.length)
    expect(groupApplications(null).counts).toEqual({ "en-attente": 0, "en-cours": 0, terminees: 0, "non-retenues": 0 })
  })

  it("onglet par défaut : celui de l'URL s'il est valide, sinon le premier non vide", () => {
    const counts = { "en-attente": 0, "en-cours": 2, terminees: 1, "non-retenues": 0 }
    expect(defaultApplicationTab(undefined, counts)).toBe("en-cours")
    expect(defaultApplicationTab("inconnu", counts)).toBe("en-cours")
    expect(defaultApplicationTab("terminees", counts)).toBe("terminees")
    expect(defaultApplicationTab(["non-retenues"], counts)).toBe("non-retenues")
    expect(defaultApplicationTab(undefined, { "en-attente": 0, "en-cours": 0, terminees: 0, "non-retenues": 0 })).toBe("en-attente")
    expect(defaultApplicationTab(undefined, undefined)).toBe("en-attente")
  })
})

describe("filtres du portefeuille étudiant", () => {
  const txs = [
    { id: 1, type: "release" },
    { id: 2, type: "withdrawal" },
    { id: 3, type: "refund" },
    { id: 4, type: "release" },
  ]

  it("4 filtres : Tout, Paiements reçus, Retraits, Remboursements", () => {
    expect(STUDENT_WALLET_FILTERS.map((f) => f.id)).toEqual(["tout", "paiements", "retraits", "remboursements"])
    expect(studentWalletFilterTypes("paiements")).toEqual(["release"])
    expect(studentWalletFilterTypes("retraits")).toEqual(["withdrawal"])
    expect(studentWalletFilterTypes("remboursements")).toEqual(["refund"])
    expect(studentWalletFilterTypes("tout")).toBeNull()
    expect(studentWalletFilterTypes("inconnu")).toBeNull()
  })

  it("parseStudentWalletFilter ramène toute valeur inconnue à tout", () => {
    expect(parseStudentWalletFilter("retraits")).toBe("retraits")
    expect(parseStudentWalletFilter(["paiements", "x"])).toBe("paiements")
    expect(parseStudentWalletFilter("recharges")).toBe("tout")
    expect(parseStudentWalletFilter(undefined)).toBe("tout")
  })

  it("filtre les mouvements", () => {
    expect(filterStudentWalletTransactions(txs, "tout")).toHaveLength(4)
    expect(filterStudentWalletTransactions(txs, "paiements").map((t) => t.id)).toEqual([1, 4])
    expect(filterStudentWalletTransactions(txs, "retraits").map((t) => t.id)).toEqual([2])
    expect(filterStudentWalletTransactions(txs, "remboursements").map((t) => t.id)).toEqual([3])
    expect(filterStudentWalletTransactions([], "retraits")).toEqual([])
  })

  it("libellé et signe de chaque mouvement", () => {
    expect(studentWalletTxView("release")).toEqual({ label: "Paiement reçu", sign: "+", direction: "credit" })
    expect(studentWalletTxView("withdrawal")).toMatchObject({ label: "Retrait", sign: "−", direction: "debit" })
    expect(studentWalletTxView("refund")).toMatchObject({ label: "Remboursement", sign: "+", direction: "credit" })
    expect(studentWalletTxView("deposit")).toEqual({ label: "Mouvement", sign: "", direction: "none" })
    expect(studentWalletTxView("__proto__")).toEqual({ label: "Mouvement", sign: "", direction: "none" })
  })
})
