import { describe, it, expect } from "vitest"
import { WALLET_TRANSACTION_TYPES } from "../supabase/database.constants.js"
import {
  formatShortDate,
  formatRelative,
  formatAmount,
  formatFcfa,
  formatDateFr,
  todayInBenin,
  isPastDeadline,
} from "./format.js"
import { missionStatusView } from "./mission-status.js"
import { applicationStatusView } from "./application-status.js"
import { escrowSplit } from "./money.js"
import {
  WALLET_FILTERS,
  parseWalletFilter,
  filterWalletTransactions,
  walletTxView,
} from "./wallet-tx.js"
import {
  clientMissionsHref,
  clientMissionHref,
  clientConversationHref,
  clientWalletHref,
  clientPublishHref,
  clientReviewHref,
} from "./client-routes.js"

const NNBSP = " "
const MINUS = "−"

describe("format", () => {
  it("réexporte les formats de la vitrine", () => {
    for (const fn of [formatFcfa, formatDateFr, todayInBenin, isPastDeadline]) {
      expect(typeof fn).toBe("function")
    }
  })

  it("formatShortDate donne le jour abrégé", () => {
    expect(formatShortDate("2026-10-08")).toBe("jeu. 8 oct.")
  })

  it("formatRelative couvre instant, minutes, heures, jours et futur", () => {
    const now = new Date("2026-10-13T12:00:00Z")
    expect(formatRelative("2026-10-13T11:59:40Z", now)).toBe("à l'instant")
    expect(formatRelative("2026-10-13T11:30:00Z", now)).toBe("il y a 30 min")
    expect(formatRelative("2026-10-13T09:00:00Z", now)).toBe("il y a 3 h")
    expect(formatRelative("2026-10-10T12:00:00Z", now)).toBe("il y a 3 j")
    expect(formatRelative("2026-10-16T12:00:00Z", now)).toBe("dans 3 j")
  })

  it("formatAmount utilise l'espace fine insécable et le vrai signe moins", () => {
    expect(formatAmount(12500)).toBe(`12${NNBSP}500 FCFA`)
    expect(formatAmount(1234567)).toBe(`1${NNBSP}234${NNBSP}567 FCFA`)
    expect(formatAmount(5000, { sign: "debit" })).toBe(`${MINUS}5${NNBSP}000 FCFA`)
    expect(formatAmount(-5000, { sign: "credit" })).toBe(`+5${NNBSP}000 FCFA`)
    expect(formatAmount(null)).toBe("0 FCFA")
  })
})

describe("missionStatusView", () => {
  const today = "2026-10-13"
  it("open sans échéance ou à venir : Ouverte", () => {
    expect(missionStatusView({ status: "open", deadline: null }, today)).toEqual({
      key: "open",
      label: "Ouverte",
      tone: "neutre",
    })
    expect(missionStatusView({ status: "open", deadline: "2026-10-13" }, today).key).toBe("open")
    expect(missionStatusView({ status: "open", deadline: "2026-11-01" }, today).key).toBe("open")
  })
  it("open avec échéance passée : Échéance dépassée", () => {
    expect(missionStatusView({ status: "open", deadline: "2026-10-12" }, today)).toEqual({
      key: "overdue",
      label: "Échéance dépassée",
      tone: "erreur",
    })
  })
  it("aucun statut n'utilise le ton citron (accent unique de l'écran)", () => {
    for (const status of ["open", "in_progress", "done", "cancelled"]) {
      expect(missionStatusView({ status }, today).tone).not.toBe("citron")
    }
  })
  it("in_progress, done et cancelled ignorent l'échéance", () => {
    const past = "2020-01-01"
    expect(missionStatusView({ status: "in_progress", deadline: past }, today)).toEqual({
      key: "in_progress",
      label: "En cours",
      tone: "bleu",
    })
    expect(missionStatusView({ status: "done", deadline: past }, today)).toEqual({
      key: "done",
      label: "Terminée",
      tone: "succes",
    })
    expect(missionStatusView({ status: "cancelled", deadline: past }, today)).toEqual({
      key: "cancelled",
      label: "Annulée",
      tone: "neutre",
    })
  })
})

describe("applicationStatusView", () => {
  it("couvre les trois statuts et retombe sur en attente", () => {
    expect(applicationStatusView("pending")).toEqual({ key: "pending", label: "En attente", tone: "alerte" })
    expect(applicationStatusView("accepted")).toEqual({ key: "accepted", label: "Acceptée", tone: "succes" })
    expect(applicationStatusView("rejected")).toEqual({ key: "rejected", label: "Non retenue", tone: "neutre" })
    expect(applicationStatusView("autre").key).toBe("pending")
  })
})

describe("escrowSplit", () => {
  it("répartit 10000 en 1200 de commission et 8800 pour l'étudiant", () => {
    expect(escrowSplit(10000)).toEqual({ total: 10000, commission: 1200, student: 8800 })
  })
  it("la somme reste égale au total, budget absent donne zéro", () => {
    const s = escrowSplit(2555)
    expect(s.commission + s.student).toBe(s.total)
    expect(escrowSplit(undefined)).toEqual({ total: 0, commission: 0, student: 0 })
  })
})

describe("wallet-tx", () => {
  it("propose 7 filtres dont les types existent en base", () => {
    expect(WALLET_FILTERS.map((f) => f.label)).toEqual([
      "Tout",
      "Recharges",
      "Réservations",
      "Libérations",
      "Commissions",
      "Remboursements",
      "Retraits",
    ])
    const typed = WALLET_FILTERS.flatMap((f) => f.types ?? [])
    expect([...typed].sort()).toEqual([...WALLET_TRANSACTION_TYPES].sort())
  })
  it("parseWalletFilter retombe sur tout", () => {
    expect(parseWalletFilter("retraits")).toBe("retraits")
    expect(parseWalletFilter(["recharges", "x"])).toBe("recharges")
    expect(parseWalletFilter("nimporte")).toBe("tout")
    expect(parseWalletFilter(undefined)).toBe("tout")
  })
  it("filterWalletTransactions garde les types du filtre", () => {
    const txs = [{ type: "deposit" }, { type: "reserve" }, { type: "withdrawal" }]
    expect(filterWalletTransactions(txs, "tout")).toHaveLength(3)
    expect(filterWalletTransactions(txs, "reservations")).toEqual([{ type: "reserve" }])
  })
  it("walletTxView donne libellé et signe, moins réel pour un débit", () => {
    expect(walletTxView("deposit")).toMatchObject({ label: "Recharge", sign: "+" })
    expect(walletTxView("withdrawal")).toMatchObject({ label: "Retrait", sign: MINUS })
    expect(walletTxView("commission").sign).toBe("")
    for (const type of WALLET_TRANSACTION_TYPES) expect(walletTxView(type).label).not.toBe("Mouvement")
    expect(walletTxView("inconnu").label).toBe("Mouvement")
  })
})

describe("client-routes", () => {
  it("clientMissionsHref omet les paramètres vides", () => {
    expect(clientMissionsHref()).toBe("/client/missions")
    expect(clientMissionsHref({ onglet: "en-cours", q: "maths" })).toBe("/client/missions?onglet=en-cours&q=maths")
  })
  it("clientMissionHref", () => {
    expect(clientMissionHref("abc")).toBe("/client/missions/abc")
    expect(clientMissionHref("abc", { candidat: "s1", confirmer: true, publiee: true })).toBe(
      "/client/missions/abc?candidat=s1&confirmer=1&publiee=1",
    )
    expect(clientMissionHref("abc", { confirmer: false })).toBe("/client/missions/abc")
  })
  it("clientConversationHref", () => {
    expect(clientConversationHref("m1")).toBe("/client/messages/m1")
    expect(clientConversationHref("m1", "s1")).toBe("/client/messages/m1?studentId=s1")
  })
  it("clientWalletHref", () => {
    expect(clientWalletHref()).toBe("/client/wallet")
    expect(clientWalletHref({ recharger: true, montant: 5000, filtre: "retraits" })).toBe(
      "/client/wallet?recharger=1&montant=5000&filtre=retraits",
    )
    expect(clientWalletHref({ filtre: "tout" })).toBe("/client/wallet")
  })
  it("clientPublishHref passe par publishHref", () => {
    expect(clientPublishHref()).toBe("/client/missions/new")
    expect(clientPublishHref({ ville: "Cotonou" })).toBe("/client/missions/new?ville=Cotonou")
    expect(clientPublishHref({ duplicate: "m1" })).toBe("/client/missions/new?duplicate=m1")
    expect(clientPublishHref({ duplicate: "m1", ville: "Cotonou" })).toBe(
      "/client/missions/new?ville=Cotonou&duplicate=m1",
    )
  })
  it("clientReviewHref renvoie l'écran d'avis client", () => {
    expect(clientReviewHref("m1")).toBe("/client/review/m1")
  })
})
