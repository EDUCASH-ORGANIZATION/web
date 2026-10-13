// QA indépendante RD-CLIENT-01 vague 0 : cas limites de src/lib/app.
import { describe, expect, it } from "vitest"
import { formatAmount, formatShortDate, formatRelative, todayInBenin, isPastDeadline } from "./format.js"
import { missionStatusView } from "./mission-status.js"
import { escrowSplit } from "./money.js"
import { WALLET_FILTERS, parseWalletFilter, filterWalletTransactions, walletTxView } from "./wallet-tx.js"
import { applicationStatusView } from "./application-status.js"
import { clientMissionsHref, clientMissionHref, clientConversationHref, clientWalletHref, clientPublishHref, clientReviewHref } from "./client-routes.js"

const NN = " "
const NB = " "

describe("QA formatAmount", () => {
  it("grands nombres et milliers fins", () => {
    expect(formatAmount(1234567890)).toBe(`1${NN}234${NN}567${NN}890${NB}FCFA`)
    expect(formatAmount(Number.MAX_SAFE_INTEGER)).toMatch(/^9 007/)
    expect(formatAmount(999)).toBe(`999${NB}FCFA`)
    expect(formatAmount(1000)).toBe(`1${NN}000${NB}FCFA`)
  })
  it("débit et crédit : vrai signe moins, jamais de trait d'union", () => {
    expect(formatAmount(47600, { sign: "debit" })).toBe(`−47${NN}600${NB}FCFA`)
    expect(formatAmount(47600, { sign: "credit" })).toBe(`+47${NN}600${NB}FCFA`)
    expect(formatAmount(-47600, { sign: "debit" })).toBe(`−47${NN}600${NB}FCFA`)
    expect(formatAmount(-47600, { sign: "debit" })).not.toContain("-")
  })
  it("null, undefined, NaN, chaîne non numérique : 0", () => {
    for (const v of [null, undefined, NaN, "abc", ""]) expect(formatAmount(v)).toBe(`0${NB}FCFA`)
    expect(formatAmount("12500")).toBe(`12${NN}500${NB}FCFA`)
  })
  it("négatif sans signe demandé : valeur absolue (comportement documenté)", () => {
    expect(formatAmount(-500)).toBe(`500${NB}FCFA`)
  })
  it("décimaux arrondis, aucune espace sécable résiduelle", () => {
    expect(formatAmount(12.4)).toBe(`12${NB}FCFA`)
    expect(formatAmount(1234.5)).not.toMatch(/ /)
  })
  it("débit de 0 : pas de signe moins devant zéro", () => {
    expect(formatAmount(0, { sign: "debit" })).toBe(`0${NB}FCFA`)
    expect(formatAmount(0.4, { sign: "credit" })).toBe(`0${NB}FCFA`)
  })
  it("Infinity, -Infinity et NaN : traités comme une valeur absente (0 FCFA), jamais le symbole infini", () => {
    for (const v of [Infinity, -Infinity, NaN]) {
      expect(formatAmount(v)).toBe(`0${NB}FCFA`)
      expect(formatAmount(v, { sign: "debit" })).toBe(`0${NB}FCFA`)
    }
  })
})

describe("QA missionStatusView, fuseau Bénin UTC+1", () => {
  it("23:30 UTC la veille = déjà le lendemain au Bénin", () => {
    expect(todayInBenin(new Date("2026-10-07T23:30:00Z"))).toBe("2026-10-08")
    expect(todayInBenin(new Date("2026-10-07T22:59:59Z"))).toBe("2026-10-07")
    expect(todayInBenin(new Date("2026-10-07T23:00:00Z"))).toBe("2026-10-08")
  })
  it("échéance = aujourd'hui : encore ouverte ; veille : dépassée", () => {
    const m = { status: "open", deadline: "2026-10-08" }
    expect(missionStatusView(m, "2026-10-08").key).toBe("open")
    expect(missionStatusView(m, "2026-10-09").key).toBe("overdue")
    expect(missionStatusView(m, "2026-10-07").key).toBe("open")
  })
  it("à minuit Bénin (23:00 UTC), la bascule se fait", () => {
    const m = { status: "open", deadline: "2026-10-07" }
    expect(missionStatusView(m, todayInBenin(new Date("2026-10-07T22:59:59Z"))).key).toBe("open")
    expect(missionStatusView(m, todayInBenin(new Date("2026-10-07T23:00:00Z"))).key).toBe("overdue")
  })
  it("échéance au format timestamp complet", () => {
    expect(missionStatusView({ status: "open", deadline: "2026-10-07T23:59:59+00:00" }, "2026-10-07").key).toBe("open")
    expect(missionStatusView({ status: "open", deadline: "2026-10-07T00:00:00Z" }, "2026-10-08").key).toBe("overdue")
  })
  it("statuts non ouverts ignorent l'échéance ; entrées invalides ne plantent pas", () => {
    for (const s of ["in_progress", "done", "cancelled"]) expect(missionStatusView({ status: s, deadline: "2000-01-01" }, "2026-10-08").key).toBe(s)
    expect(missionStatusView(null, "2026-10-08").key).toBe("open")
    expect(missionStatusView(undefined, undefined).key).toBe("open")
    expect(missionStatusView({ status: "weird", deadline: "2000-01-01" }, "2026-10-08").key).toBe("overdue")
    expect(missionStatusView({ status: "open", deadline: "" }, "2026-10-08").key).toBe("open")
  })
  it("retourne une copie : muter le résultat ne pollue pas", () => {
    const a = missionStatusView({ status: "done" }, "2026-01-01")
    a.label = "X"
    expect(missionStatusView({ status: "done" }, "2026-01-01").label).toBe("Terminée")
  })
  it("isPastDeadline sans today ne lève pas", () => {
    expect(() => isPastDeadline("2026-01-01", undefined)).not.toThrow()
  })
})

describe("QA dates", () => {
  it("formatShortDate : date seule non décalée par le fuseau, timestamp en heure du Bénin", () => {
    expect(formatShortDate("2026-10-08")).toMatch(/jeu\.? 8 oct/)
    expect(formatShortDate("2026-10-07T23:30:00Z")).toMatch(/jeu\.? 8 oct/)
    expect(formatShortDate("2026-10-07T22:30:00Z")).toMatch(/mer\.? 7 oct/)
  })
  it("formatRelative : bornes", () => {
    const now = new Date("2026-10-10T12:00:00Z")
    expect(formatRelative(new Date(now - 59_999), now)).toBe("à l'instant")
    expect(formatRelative(new Date(now - 60_000), now)).toBe("il y a 1 min")
    expect(formatRelative(new Date(now - 3_600_000), now)).toBe("il y a 1 h")
    expect(formatRelative(new Date(now - 86_400_000), now)).toBe("il y a 1 j")
    expect(formatRelative(new Date(+now + 3 * 86_400_000), now)).toBe("dans 3 j")
    expect(formatRelative("2026-10-07", now)).toMatch(/^il y a 3 j$/)
  })
})

describe("dates absentes ou invalides", () => {
  it("formatShortDate et formatRelative renvoient une chaîne vide, sans exception", () => {
    for (const v of [null, undefined, "", "pas une date", "2026-13-45", new Date("x"), NaN]) {
      expect(formatShortDate(v)).toBe("")
      expect(formatRelative(v, new Date("2026-10-10T12:00:00Z"))).toBe("")
    }
  })
})

describe("QA escrowSplit", () => {
  it("invariant total = commission + student et pas de dérive flottante, de 0 à 300000", () => {
    for (let t = 0; t <= 300000; t++) {
      const { total, commission, student } = escrowSplit(t)
      if (total !== commission + student) throw new Error(`somme ${t}`)
      if (student !== Math.floor((t * 88 + 50) / 100)) throw new Error(`arrondi ${t}: ${student}`)
      if (!Number.isInteger(commission) || commission < 0) throw new Error(`commission ${t}`)
    }
  })
  it("montants impairs", () => {
    expect(escrowSplit(9999)).toEqual({ total: 9999, commission: 1200, student: 8799 })
    expect(escrowSplit(1)).toEqual({ total: 1, commission: 0, student: 1 })
    expect(escrowSplit(5)).toEqual({ total: 5, commission: 1, student: 4 })
    expect(escrowSplit(10000)).toEqual({ total: 10000, commission: 1200, student: 8800 })
  })
  it("entrées invalides : zéro, pas de NaN", () => {
    for (const v of [null, undefined, NaN, "x", -0]) {
      const r = escrowSplit(v)
      expect(Object.values(r).every(Number.isFinite)).toBe(true)
      expect(r.total).toBe(0)
    }
    expect(escrowSplit("10000").student).toBe(8800)
  })
  it("négatif : somme conservée", () => {
    const r = escrowSplit(-1000)
    expect(r.commission + r.student).toBe(r.total)
  })
})

describe("QA wallet-tx", () => {
  const txs = [{ type: "deposit" }, { type: "reserve" }, { type: "release" }, { type: "commission" }, { type: "refund" }, { type: "withdrawal" }, { type: "deposit" }]
  it("chaque filtre ne garde que son type, tout garde tout, les types sont couverts", () => {
    expect(filterWalletTransactions(txs, "tout")).toHaveLength(7)
    expect(filterWalletTransactions(txs, "recharges")).toHaveLength(2)
    for (const f of WALLET_FILTERS.filter((x) => x.types)) expect(filterWalletTransactions(txs, f.id).every((t) => f.types.includes(t.type))).toBe(true)
    const covered = new Set(WALLET_FILTERS.flatMap((f) => f.types ?? []))
    for (const t of txs) expect(covered.has(t.type)).toBe(true)
  })
  it("filtre inconnu ou liste vide", () => {
    expect(filterWalletTransactions(txs, "nimporte")).toBe(txs)
    expect(filterWalletTransactions([], "retraits")).toEqual([])
    expect(filterWalletTransactions(txs, "__proto__")).toBe(txs)
  })
  it("parseWalletFilter : valeurs hostiles", () => {
    for (const v of [undefined, null, "", "RECHARGES", "recharges ", "__proto__", "constructor", 5, {}, [], ["x"]]) expect(parseWalletFilter(v)).toBe("tout")
    expect(parseWalletFilter(["retraits", "x"])).toBe("retraits")
    expect(parseWalletFilter("retraits")).toBe("retraits")
  })
  it("walletTxView : clé de prototype et type inconnu retombent sur Mouvement", () => {
    expect(walletTxView("zzz").label).toBe("Mouvement")
    for (const k of ["toString", "constructor", "__proto__", "hasOwnProperty"]) expect(walletTxView(k).label).toBe("Mouvement")
    expect(walletTxView("reserve").sign).toBe("−")
  })
  it("applicationStatusView : inconnu -> en attente", () => {
    expect(applicationStatusView("zzz").key).toBe("pending")
    expect(applicationStatusView(undefined).label).toBe("En attente")
  })
})

describe("QA client-routes", () => {
  it("caractères spéciaux encodés dans le chemin", () => {
    expect(clientMissionHref("a/b?c#d")).toBe("/client/missions/a%2Fb%3Fc%23d")
    expect(clientMissionHref("../../admin")).not.toContain("../")
    expect(clientConversationHref("m 1", "s&x=1")).toBe("/client/messages/m%201?studentId=s%26x%3D1")
    expect(clientReviewHref("../x")).toBe("/review/..%2Fx")
  })
  it("injection dans les paramètres : un seul paramètre, valeur encodée", () => {
    const u = new URL(clientMissionsHref({ q: "a&onglet=done#frag" }), "http://x")
    expect([...u.searchParams.keys()]).toEqual(["q"])
    expect(u.searchParams.get("q")).toBe("a&onglet=done#frag")
    expect(u.hash).toBe("")
    const w = new URL(clientWalletHref({ montant: "1&recharger=0", filtre: "x&y" }), "http://x")
    expect(w.searchParams.get("montant")).toBeNull()
    expect(w.searchParams.get("recharger")).toBeNull()
    const c = new URL(clientMissionHref("1", { candidat: "s&confirmer=1" }), "http://x")
    expect(c.searchParams.get("confirmer")).toBeNull()
  })
  it("paramètres vides omis, filtre tout omis, montant 0 ou non numérique omis", () => {
    expect(clientMissionsHref()).toBe("/client/missions")
    expect(clientMissionsHref({ onglet: "", q: undefined })).toBe("/client/missions")
    expect(clientWalletHref({ filtre: "tout" })).toBe("/client/wallet")
    expect(clientWalletHref({ recharger: true, montant: 0 })).toBe("/client/wallet?recharger=1")
    expect(clientWalletHref({ recharger: false })).toBe("/client/wallet")
    expect(clientConversationHref("m")).toBe("/client/messages/m")
  })
  it("clientMissionHref sans identifiant renvoie la liste ; montant non fini omis", () => {
    for (const v of [undefined, null, ""]) expect(clientMissionHref(v)).toBe("/client/missions")
    expect(clientMissionHref(undefined, { confirmer: true })).toBe("/client/missions")
    for (const m of [NaN, Infinity, -Infinity]) expect(clientWalletHref({ recharger: true, montant: m })).toBe("/client/wallet?recharger=1")
    expect(clientWalletHref({ montant: 5000 })).toBe("/client/wallet?montant=5000")
  })
  it("conversation et avis sans identifiant : repli ; montant négatif ou non numérique omis", () => {
    for (const v of [undefined, null, ""]) {
      expect(clientConversationHref(v)).toBe("/client/messages")
      expect(clientConversationHref(v, "s1")).toBe("/client/messages")
      expect(clientReviewHref(v)).toBe("/client/missions")
    }
    for (const m of [-5, 0, "abc", "", "0", true]) expect(clientWalletHref({ montant: m })).toBe("/client/wallet")
    expect(clientWalletHref({ montant: "2500" })).toBe("/client/wallet?montant=2500")
  })
  it("formatShortDate refuse les dates qui débordent ; formatRelative sans NaN", () => {
    expect(formatShortDate("2026-02-30")).toBe("")
    expect(formatShortDate("2026-13-01")).toBe("")
    expect(formatShortDate("2026-02-28")).not.toBe("")
    expect(formatShortDate("2024-02-29")).not.toBe("")
    expect(formatShortDate("2026-02-29")).toBe("")
    expect(formatRelative("2026-02-30", new Date("2026-10-13T12:00:00Z"))).toBe("")
    expect(formatRelative("2026-10-10T12:00:00Z", new Date("x"))).toBe("")
  })
  it("clientPublishHref : duplicate seul, avec préremplissage, injection", () => {
    expect(clientPublishHref()).toBe("/client/missions/new")
    expect(clientPublishHref({ duplicate: "abc" })).toBe("/client/missions/new?duplicate=abc")
    expect(clientPublishHref({ duplicate: "a&b", besoin: "x" })).toBe("/client/missions/new?besoin=x&duplicate=a%26b")
    const u = new URL(clientPublishHref({ besoin: "é&ville=Evil", duplicate: "1#x" }), "http://x")
    expect(u.searchParams.get("ville")).toBeNull()
    expect(u.searchParams.get("duplicate")).toBe("1#x")
  })
  it("les chemins restent relatifs à l'origine (pas d'URL absolue ni protocole-relatif)", () => {
    for (const h of [clientMissionHref("//evil.com"), clientConversationHref("//evil.com", "x"), clientReviewHref("//evil.com")]) {
      expect(h.startsWith("/")).toBe(true)
      expect(h.startsWith("//")).toBe(false)
    }
  })
})

describe("QA applicationStatusView clé de prototype", () => {
  it("'toString' et autres clés de prototype retombent sur en attente", () => {
    for (const k of ["toString", "constructor", "__proto__"]) expect(applicationStatusView(k).key).toBe("pending")
  })
})
