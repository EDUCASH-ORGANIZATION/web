import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import * as requests from "./requests.js"
import {
  PURCHASE_STATUSES,
  PURCHASE_AMOUNT_MIN,
  PURCHASE_AMOUNT_MAX,
  PURCHASE_MAX_PER_MISSION,
  PURCHASE_MAX_SEQ,
  ESTIMATE_SOFT_RATIO,
  PURCHASE_REPORT_REASONS,
  PAYMENT_WARNING,
  PAYEE_KINDS,
  statusLabel,
  statusBadge,
  purchaseReportReasonLabel,
  requestNumber,
  formatPurchaseAmount,
  parsePayeeNumber,
  normalizePayeeNumber,
  formatPayeeNumber,
  isProfilePhone,
  parsePurchaseAmount,
  exceedsEstimate,
  purchaseTotals,
  nextSeq,
  canTransition,
  allowedActions,
  canCreateRequest,
  purchaseMessageContent,
  isPurchaseMessageContent,
  createPurchaseSchema,
  editPurchaseSchema,
  purchaseVersionSchema,
  markPaidSchema,
  reportPurchaseSchema,
} from "./requests.js"
import { PAYMENT_WARNING as AIDE_WARNING } from "@/components/vitrine/aide/aide-content"
import { REPORT_REASONS } from "@/lib/messaging/moderation-rules"

// Le caractère est construit pour que ce fichier ne le contienne jamais (garde no-em-dash).
const EM_DASH = String.fromCharCode(0x2014)

const MISSION = "11111111-1111-4111-8111-111111111111"
const REQUEST = "33333333-3333-4333-8333-333333333333"
const STUDENT = "44444444-4444-4444-8444-444444444444"
const PATH_A = `${STUDENT}/${REQUEST}/payee-a1b2c3d4e5.jpg`
const PATH_B = `${STUDENT}/${REQUEST}/ticket-a1b2c3d4e5.jpg`

const validCreate = {
  missionId: MISSION,
  requestId: REQUEST,
  payeeKind: "merchant",
  payeeNumber: "123 456",
  payeePhotoPath: PATH_A,
  vendorName: "Poissonnerie Dossa",
  items: "Poisson fumé, crevettes",
  amount: "6 000",
  ticketPhotoPath: PATH_B,
}

describe("constantes", () => {
  it("statuts, bornes et limites du plan", () => {
    expect(PURCHASE_STATUSES).toEqual(["pending", "paid", "received", "reported", "cancelled"])
    expect(PURCHASE_AMOUNT_MIN).toBe(100)
    expect(PURCHASE_AMOUNT_MAX).toBe(500000)
    expect(PURCHASE_MAX_PER_MISSION).toBe(20)
    expect(PURCHASE_MAX_SEQ).toBe(99)
    expect(ESTIMATE_SOFT_RATIO).toBe(1.5)
    expect(PAYEE_KINDS.map((k) => k.value)).toEqual(["merchant", "personal"])
  })

  it("PAYMENT_WARNING est une source unique, réexportée à l'identique par l'aide", () => {
    expect(PAYMENT_WARNING).toBe(
      "Vérifiez le nom du bénéficiaire affiché par MoMo avant de payer. EduCash n'intervient pas dans ce paiement.",
    )
    expect(AIDE_WARNING).toBe(PAYMENT_WARNING)
  })

  it("motifs d'achats : 4 valeurs purchase_* plus other, sans recoupement avec la messagerie sauf other", () => {
    const values = PURCHASE_REPORT_REASONS.map((r) => r.value)
    expect(values).toEqual([
      "purchase_amount_mismatch",
      "purchase_payee_mismatch",
      "purchase_vendor_not_paid",
      "purchase_items_not_delivered",
      "other",
    ])
    expect(PURCHASE_REPORT_REASONS.map((r) => r.label)).toEqual([
      "Montant différent du ticket",
      "Bénéficiaire MoMo différent du vendeur",
      "Le vendeur n'a pas reçu l'argent",
      "Achats non livrés",
      "Autre",
    ])
    const shared = values.filter((v) => REPORT_REASONS.some((r) => r.value === v))
    expect(shared).toEqual(["other"])
    expect(purchaseReportReasonLabel("purchase_vendor_not_paid")).toBe("Le vendeur n'a pas reçu l'argent")
    expect(purchaseReportReasonLabel("scam")).toBe("")
  })
})

describe("textes : vouvoiement, argent, vocabulaire", () => {
  const texts = Object.entries(requests).filter(([, v]) => typeof v === "string")
  const refusals = Object.values(requests.PURCHASE_CREATE_REFUSALS)
  const all = [...texts.map(([, v]) => v), ...refusals, ...PURCHASE_REPORT_REASONS.map((r) => r.label), ...PAYEE_KINDS.map((k) => k.label)]

  it("expose des textes à contrôler", () => {
    expect(texts.length).toBeGreaterThanOrEqual(6)
  })

  it("aucun « vous touchez », tiret cadratin, tutoiement ni mot banni", () => {
    for (const text of all) {
      expect(text).not.toMatch(/vous touchez/i)
      expect(text).not.toContain(EM_DASH)
      expect(text).not.toMatch(/\b(?:tu|toi|ton|ta|tes|te)\b/i)
      expect(text).not.toMatch(/livraison|course|coursier|saisie|prestataire|commission/i)
    }
  })

  it("l'avertissement dit que EduCash n'intervient pas et demande de vérifier le bénéficiaire", () => {
    expect(PAYMENT_WARNING).toContain("EduCash n'intervient pas dans ce paiement")
    expect(PAYMENT_WARNING).toContain("Vérifiez le nom du bénéficiaire affiché par MoMo avant de payer")
    expect(requests.PURCHASE_STUDENT_FORM_NOTE).toContain(PAYMENT_WARNING)
  })

  it("le domaine n'écrit jamais 0.12 en dur et n'importe rien du serveur", () => {
    const source = readFileSync(new URL("./requests.js", import.meta.url), "utf8")
    expect(source).not.toMatch(/0\.12/)
    expect(source).not.toMatch(/server-only|next\/headers|supabase|createServiceClient/)
  })
})

describe("statusLabel et statusBadge", () => {
  it("libellés des 4 statuts de la planche", () => {
    expect(statusLabel("pending")).toBe("En attente de paiement")
    expect(statusLabel("paid")).toBe("Payé")
    expect(statusLabel("received")).toBe("Reçu par le vendeur")
    expect(statusLabel("reported")).toBe("Signalé")
    expect(statusLabel("cancelled")).toBe("Annulée")
  })

  it("variantes de badge de la planche", () => {
    expect(statusBadge("pending")).toEqual({ label: "En attente de paiement", variant: "alerte" })
    expect(statusBadge("paid").variant).toBe("neutre")
    expect(statusBadge("received").variant).toBe("succes")
    expect(statusBadge("reported").variant).toBe("erreur")
  })

  it.each(["", "refused", "constructor", "__proto__", undefined, null, 4])("statut inconnu %j", (status) => {
    expect(statusLabel(status)).toBe("")
    expect(statusBadge(status)).toEqual({ label: "", variant: "neutre" })
  })

  it("renvoie une copie du badge", () => {
    statusBadge("paid").label = "x"
    expect(statusBadge("paid").label).toBe("Payé")
  })
})

describe("requestNumber et formatPurchaseAmount", () => {
  it("numéro de demande", () => {
    expect(requestNumber(2)).toBe("N° 2")
    expect(requestNumber(99)).toBe("N° 99")
  })

  it.each([0, -1, 100, 1.5, "2", null, undefined, NaN])("numéro invalide %j", (seq) => {
    expect(requestNumber(seq)).toBe("")
  })

  it("montant en FCFA avec espaces insécables", () => {
    expect(formatPurchaseAmount(6000)).toBe("6 000 FCFA")
    expect(formatPurchaseAmount(500000)).toBe("500 000 FCFA")
    expect(formatPurchaseAmount(100)).toBe("100 FCFA")
  })
})

describe("numéro à payer", () => {
  it.each([
    ["marchand 4 chiffres", "1234", "merchant", "1234"],
    ["marchand 6 chiffres avec espaces", "123 456", "merchant", "123456"],
    ["marchand avec points et tirets", "12.34-56", "merchant", "123456"],
    ["marchand 10 chiffres hors 01", "9712345678", "merchant", "9712345678"],
    ["marchand avec espace insécable", "12 34 56", "merchant", "123456"],
    ["perso national", "0197123456", "personal", "+2290197123456"],
    ["perso avec espaces", "01 97 12 34 56", "personal", "+2290197123456"],
    ["perso avec tirets", "01-97-12-34-56", "personal", "+2290197123456"],
    ["perso avec parenthèses", "(01) 97 12 34 56", "personal", "+2290197123456"],
    ["perso avec +229", "+229 01 97 12 34 56", "personal", "+2290197123456"],
    ["perso collé +229", "+2290197123456", "personal", "+2290197123456"],
    ["perso avec 00229", "00229 0197123456", "personal", "+2290197123456"],
    ["perso avec 229", "2290197123456", "personal", "+2290197123456"],
    ["perso en 01 6", "0161000000", "personal", "+2290161000000"],
  ])("accepte : %s", (_name, raw, kind, expected) => {
    expect(normalizePayeeNumber(raw, kind)).toBe(expected)
  })

  it.each([
    ["marchand trop court", "123", "merchant"],
    ["marchand trop long", "12345678901", "merchant"],
    ["marchand avec lettres", "12ab56", "merchant"],
    ["marchand avec plus", "+123456", "merchant"],
    ["marchand vide", "", "merchant"],
    ["marchand égal à un téléphone", "0197123456", "merchant"],
    ["marchand égal à un téléphone avec espaces", "01 97 12 34 56", "merchant"],
    ["perso à l'ancien format de 8 chiffres", "97123456", "personal"],
    ["perso à 9 chiffres", "019712345", "personal"],
    ["perso à 11 chiffres", "01971234567", "personal"],
    ["perso ne commençant pas par 01", "0297123456", "personal"],
    ["perso étranger", "+33612345678", "personal"],
    ["perso +229 sans 01", "+22997123456", "personal"],
    ["perso avec lettres", "01 97 12 34 5a", "personal"],
    ["perso avec un plus au milieu", "01+97123456", "personal"],
    ["perso doublé", "+229+2290197123456", "personal"],
    ["perso vide", "", "personal"],
    ["type inconnu", "123456", "other"],
    ["type absent", "123456", undefined],
    ["valeur non texte", 123456, "merchant"],
    ["valeur nulle", null, "personal"],
    ["valeur objet", { toString: () => "123456" }, "merchant"],
    ["chiffres arabes", "٠١٩٧١٢٣٤٥٦", "personal"],
  ])("refuse : %s", (_name, raw, kind) => {
    expect(normalizePayeeNumber(raw, kind)).toBeNull()
    expect(parsePayeeNumber(raw, kind).ok).toBe(false)
  })

  it("les messages d'erreur sont vouvoyés et distincts selon le type", () => {
    const merchant = parsePayeeNumber("12", "merchant").error
    const personal = parsePayeeNumber("12", "personal").error
    const phoneLike = parsePayeeNumber("0197123456", "merchant").error
    expect(new Set([merchant, personal, phoneLike]).size).toBe(3)
    expect(personal).toMatch(/^Indiquez/)
    expect(phoneLike).toContain("Numéro perso")
  })

  it("une entrée démesurée est coupée avant l'analyse", () => {
    expect(normalizePayeeNumber("1".repeat(100000), "merchant")).toBeNull()
  })

  it("formatPayeeNumber : perso groupé, marchand tel quel, reste vide", () => {
    expect(formatPayeeNumber("+2290197123456")).toBe("+229 01 97 12 34 56")
    expect(formatPayeeNumber("123456")).toBe("123456")
    for (const bad of ["", "abc", "+22997123456", "0197123456", "12", "12345678901", null, undefined, 123456]) {
      expect(formatPayeeNumber(bad)).toBe("")
    }
  })

  it("formatPayeeNumber relit ce que normalizePayeeNumber produit", () => {
    for (const [raw, kind] of [["01 97 12 34 56", "personal"], ["1234", "merchant"]]) {
      expect(formatPayeeNumber(normalizePayeeNumber(raw, kind))).not.toBe("")
    }
  })

  describe("isProfilePhone", () => {
    it("reconnaît le téléphone de profil quel que soit le format", () => {
      expect(isProfilePhone("+2290197123456", "+2290197123456")).toBe(true)
      expect(isProfilePhone("+2290197123456", "0197123456")).toBe(true)
      expect(isProfilePhone("+2290197123456", "01 97 12 34 56")).toBe(true)
      expect(isProfilePhone("+2290197123456", "229 0197123456")).toBe(true)
      expect(isProfilePhone("+2290197123456", "00229 0197123456")).toBe(true)
    })

    it("refuse un autre numéro, un téléphone absent ou invalide", () => {
      expect(isProfilePhone("+2290197123456", "+2290197123457")).toBe(false)
      expect(isProfilePhone("123456", "+2290197123456")).toBe(false)
      expect(isProfilePhone("+2290197123456", "")).toBe(false)
      expect(isProfilePhone("+2290197123456", null)).toBe(false)
      expect(isProfilePhone("", "")).toBe(false)
      expect(isProfilePhone(undefined, undefined)).toBe(false)
    })
  })
})

describe("parsePurchaseAmount", () => {
  it.each([
    [100, 100],
    [500000, 500000],
    [6000, 6000],
    ["6000", 6000],
    ["6 000", 6000],
    ["12 750", 12750],
    ["12 750", 12750],
    [" 500 000 ", 500000],
    ["000100", 100],
  ])("accepte %j", (raw, expected) => {
    expect(parsePurchaseAmount(raw)).toEqual({ ok: true, value: expected })
  })

  it.each([
    99,
    0,
    -100,
    500001,
    1000000,
    100.5,
    "99",
    "500001",
    "100.5",
    "100,5",
    "-100",
    "+100",
    "1e3",
    "0x64",
    "cent",
    "",
    " ",
    "1".repeat(40),
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 2,
    null,
    undefined,
    true,
    {},
    [100],
  ])("refuse %j", (raw) => {
    const result = parsePurchaseAmount(raw)
    expect(result.ok).toBe(false)
    expect(result.error).toContain("500 000")
  })
})

describe("exceedsEstimate (avertissement, jamais bloquant)", () => {
  it("seulement au-delà de 1,5 fois l'estimation", () => {
    expect(exceedsEstimate({ requested: 15000, estimate: 10000 })).toBe(false)
    expect(exceedsEstimate({ requested: 15001, estimate: 10000 })).toBe(true)
    expect(exceedsEstimate({ requested: 9000, estimate: 10000 })).toBe(false)
    expect(exceedsEstimate({ requested: 10000, estimate: 10000 })).toBe(false)
  })

  it.each([null, undefined, 0, -5, NaN, "10000"])("sans estimation exploitable (%j) : jamais", (estimate) => {
    expect(exceedsEstimate({ requested: 400000, estimate })).toBe(false)
  })

  it("requested invalide ou appel vide : faux", () => {
    expect(exceedsEstimate({ requested: NaN, estimate: 10 })).toBe(false)
    expect(exceedsEstimate({ requested: "20000", estimate: 10 })).toBe(false)
    expect(exceedsEstimate()).toBe(false)
  })
})

describe("purchaseTotals", () => {
  const rows = [
    { status: "pending", amount: 6000 },
    { status: "paid", amount: 12750 },
    { status: "received", amount: 21500 },
    { status: "reported", amount: 3000 },
    { status: "cancelled", amount: 99999 },
  ]

  it("sans demande : tout à zéro", () => {
    expect(purchaseTotals([])).toEqual({ count: 0, requested: 0, paid: 0, pending: 0, reported: 0 })
  })

  it("compte les demandes non annulées et sépare payé, en attente et signalé", () => {
    expect(purchaseTotals(rows)).toEqual({ count: 4, requested: 43250, paid: 34250, pending: 6000, reported: 3000 })
  })

  it("requested = pending + paid + reported", () => {
    const t = purchaseTotals(rows)
    expect(t.requested).toBe(t.pending + t.paid + t.reported)
  })

  it("une demande annulée n'est comptée nulle part", () => {
    expect(purchaseTotals([{ status: "cancelled", amount: 5000 }])).toEqual({ count: 0, requested: 0, paid: 0, pending: 0, reported: 0 })
  })

  it("l'estimation n'est jamais additionnée, même glissée dans les lignes", () => {
    const withEstimate = rows.map((r) => ({ ...r, purchasesEstimate: 1000000, estimate: 1000000 }))
    expect(purchaseTotals(withEstimate)).toEqual(purchaseTotals(rows))
    expect(purchaseTotals.length).toBe(1)
  })

  it("ignore les lignes invalides sans planter", () => {
    const dirty = [
      { status: "pending", amount: 1000 },
      { status: "pending", amount: "1000" },
      { status: "pending", amount: 10.5 },
      { status: "pending", amount: -5 },
      { status: "pending", amount: 0 },
      { status: "pending", amount: NaN },
      { status: "pending", amount: Number.MAX_SAFE_INTEGER + 2 },
      { status: "refused", amount: 1000 },
      { status: undefined, amount: 1000 },
      { amount: 1000 },
      null,
      undefined,
      "x",
    ]
    expect(purchaseTotals(dirty)).toEqual({ count: 1, requested: 1000, paid: 0, pending: 1000, reported: 0 })
  })

  it.each([null, undefined, {}, "x", 5])("entrée non liste (%j) : zéros", (input) => {
    expect(purchaseTotals(input).count).toBe(0)
  })
})

describe("nextSeq", () => {
  it("maximum plus un, annulées comprises", () => {
    expect(nextSeq([])).toBe(1)
    expect(nextSeq([{ seq: 1 }, { seq: 3 }, { seq: 2 }])).toBe(4)
  })

  it("null au-delà de 99", () => {
    expect(nextSeq([{ seq: 98 }])).toBe(99)
    expect(nextSeq([{ seq: 99 }])).toBeNull()
  })

  it("ignore les numéros invalides", () => {
    expect(nextSeq([{ seq: 0 }, { seq: -2 }, { seq: "7" }, { seq: 1.5 }, null, {}])).toBe(1)
    expect(nextSeq(undefined)).toBe(1)
  })
})

describe("canTransition (statut et rôle)", () => {
  const roles = ["student", "client", "admin", undefined]
  const allowed = [
    ["pending", "pending", "student"],
    ["pending", "cancelled", "student"],
    ["pending", "paid", "client"],
    ["paid", "received", "student"],
    ["pending", "reported", "student"],
    ["pending", "reported", "client"],
    ["paid", "reported", "student"],
    ["paid", "reported", "client"],
    ["received", "reported", "student"],
    ["received", "reported", "client"],
  ]

  it("exactement la table du plan, pour tous les statuts et tous les rôles", () => {
    for (const from of [...PURCHASE_STATUSES, "refused"]) {
      for (const to of [...PURCHASE_STATUSES, "refused"]) {
        for (const role of roles) {
          const expected = allowed.some(([f, t, r]) => f === from && t === to && r === role)
          expect(canTransition(from, to, role), `${from} -> ${to} (${role})`).toBe(expected)
        }
      }
    }
  })

  it("le client ne peut ni annuler, ni modifier, ni confirmer la réception", () => {
    expect(canTransition("pending", "cancelled", "client")).toBe(false)
    expect(canTransition("pending", "pending", "client")).toBe(false)
    expect(canTransition("paid", "received", "client")).toBe(false)
  })

  it("l'étudiant ne peut pas marquer « Payé »", () => {
    expect(canTransition("pending", "paid", "student")).toBe(false)
  })

  it("transitions interdites : pas de retour, pas de saut, pas de sortie d'un état final", () => {
    expect(canTransition("paid", "pending", "client")).toBe(false)
    expect(canTransition("pending", "received", "student")).toBe(false)
    expect(canTransition("received", "paid", "client")).toBe(false)
    expect(canTransition("cancelled", "pending", "student")).toBe(false)
    expect(canTransition("cancelled", "reported", "client")).toBe(false)
    expect(canTransition("reported", "paid", "client")).toBe(false)
    expect(canTransition("reported", "received", "student")).toBe(false)
    expect(canTransition("reported", "reported", "client")).toBe(false)
    expect(canTransition("paid", "cancelled", "student")).toBe(false)
  })
})

describe("allowedActions (D1, D5, D6)", () => {
  const act = (status, role, missionStatus, alreadyReportedByMe) => allowedActions({ status, role, missionStatus, alreadyReportedByMe })

  it("étudiant, demande en attente, mission en cours : modifier, annuler, signaler", () => {
    expect(act("pending", "student", "in_progress")).toEqual(["edit", "cancel", "report"])
  })

  it("client, demande en attente, mission en cours : « Payé » puis signaler", () => {
    expect(act("pending", "client", "in_progress")).toEqual(["markPaid", "report"])
  })

  it("étudiant, demande payée : confirmer la réception ou signaler", () => {
    expect(act("paid", "student", "in_progress")).toEqual(["confirmReceived", "report"])
  })

  it("client, demande payée : seulement signaler", () => {
    expect(act("paid", "client", "in_progress")).toEqual(["report"])
  })

  it("demande reçue : verrouillée, seul « Signaler » reste, pour les deux", () => {
    expect(act("received", "student", "in_progress")).toEqual(["report"])
    expect(act("received", "client", "done")).toEqual(["report"])
  })

  it("demande annulée : plus aucune action", () => {
    for (const role of ["student", "client"]) {
      for (const mission of ["open", "in_progress", "done", "cancelled"]) expect(act("cancelled", role, mission)).toEqual([])
    }
  })

  it("mission terminée : « Payé » et « Reçu » permis, ni modification ni annulation", () => {
    expect(act("pending", "student", "done")).toEqual(["report"])
    expect(act("pending", "client", "done")).toEqual(["markPaid", "report"])
    expect(act("paid", "student", "done")).toEqual(["confirmReceived", "report"])
  })

  it("mission annulée : signalement seulement", () => {
    expect(act("pending", "student", "cancelled")).toEqual(["report"])
    expect(act("pending", "client", "cancelled")).toEqual(["report"])
    expect(act("paid", "student", "cancelled")).toEqual(["report"])
    expect(act("received", "client", "cancelled")).toEqual(["report"])
  })

  it("double signalement : chaque partie signale une fois, même si l'autre l'a déjà fait", () => {
    expect(act("reported", "student", "in_progress", false)).toEqual(["report"])
    expect(act("reported", "client", "in_progress", false)).toEqual(["report"])
    expect(act("reported", "student", "in_progress", true)).toEqual([])
    expect(act("reported", "client", "done", true)).toEqual([])
    expect(act("pending", "client", "in_progress", true)).toEqual(["markPaid"])
    expect(act("received", "student", "in_progress", true)).toEqual([])
  })

  it("alreadyReportedByMe doit valoir exactement true pour masquer « Signaler »", () => {
    expect(act("reported", "student", "in_progress", "oui")).toEqual(["report"])
    expect(act("reported", "student", "in_progress", undefined)).toEqual(["report"])
  })

  it("une demande signalée ne permet ni paiement, ni réception, ni modification", () => {
    for (const role of ["student", "client"]) {
      expect(act("reported", role, "in_progress", false)).not.toEqual(expect.arrayContaining(["markPaid"]))
      expect(act("reported", role, "in_progress", false)).not.toEqual(expect.arrayContaining(["confirmReceived", "edit", "cancel"]))
    }
  })

  it("rôle inconnu, admin, statut de mission inconnu ou absent : rien", () => {
    expect(act("pending", "admin", "in_progress")).toEqual([])
    expect(act("pending", undefined, "in_progress")).toEqual([])
    expect(act("pending", "student", "archived")).toEqual([])
    expect(act("pending", "student", undefined)).toEqual([])
    expect(act("unknown", "student", "in_progress")).toEqual([])
    expect(allowedActions()).toEqual([])
  })

  it("chaque action proposée correspond à une transition autorisée", () => {
    const target = { edit: "pending", cancel: "cancelled", markPaid: "paid", confirmReceived: "received", report: "reported" }
    for (const status of PURCHASE_STATUSES) {
      for (const role of ["student", "client"]) {
        for (const mission of ["in_progress", "done", "cancelled"]) {
          for (const action of act(status, role, mission, false)) {
            if (action === "report" && status === "reported") continue
            expect(canTransition(status, target[action], role), `${action} ${status} ${role}`).toBe(true)
          }
        }
      }
    }
  })
})

describe("canCreateRequest", () => {
  const base = { role: "student", missionStatus: "in_progress", purchasesEstimate: 20000, activeCount: 0, nextSeq: 1 }

  it("étudiant, mission en cours avec achats prévus", () => {
    expect(canCreateRequest(base)).toEqual({ ok: true })
  })

  it("la 20e demande passe, la 21e est refusée", () => {
    expect(canCreateRequest({ ...base, activeCount: 19 })).toEqual({ ok: true })
    const refused = canCreateRequest({ ...base, activeCount: 20 })
    expect(refused).toMatchObject({ ok: false, reason: "limit" })
    expect(refused.message).toContain("20 demandes")
  })

  it("plus de numéro d'ordre disponible : refus", () => {
    expect(canCreateRequest({ ...base, nextSeq: null })).toMatchObject({ ok: false, reason: "limit" })
  })

  it.each([
    ["client", { role: "client" }, "role"],
    ["admin", { role: "admin" }, "role"],
    ["mission ouverte", { missionStatus: "open" }, "mission"],
    ["mission terminée", { missionStatus: "done" }, "mission"],
    ["mission annulée", { missionStatus: "cancelled" }, "mission"],
    ["sans estimation (D3)", { purchasesEstimate: null }, "estimate"],
    ["estimation nulle", { purchasesEstimate: 0 }, "estimate"],
    ["estimation texte", { purchasesEstimate: "20000" }, "estimate"],
    ["compteur invalide", { activeCount: NaN }, "limit"],
  ])("refuse : %s", (_name, override, reason) => {
    expect(canCreateRequest({ ...base, ...override })).toMatchObject({ ok: false, reason })
  })

  it("l'estimation n'est qu'une condition d'accès, jamais un plafond bloquant", () => {
    expect(canCreateRequest({ ...base, purchasesEstimate: 100 })).toEqual({ ok: true })
  })
})

describe("textes fixes des messages d'achat", () => {
  it("la carte et chaque événement ont un texte sans numéro ni nom de vendeur", () => {
    expect(purchaseMessageContent("purchase_request", 2)).toBe("Demande de paiement d'achats N° 2")
    expect(purchaseMessageContent("purchase_event", 2, "updated")).toBe("La demande N° 2 a été modifiée.")
    expect(purchaseMessageContent("purchase_event", 2, "cancelled")).toBe("La demande N° 2 a été annulée.")
    expect(purchaseMessageContent("purchase_event", 2, "paid")).toBe("La demande N° 2 est marquée « Payé ».")
    expect(purchaseMessageContent("purchase_event", 2, "received")).toBe("Le vendeur a bien reçu le paiement de la demande N° 2.")
    expect(purchaseMessageContent("purchase_event", 2, "reported")).toBe("La demande N° 2 a été signalée.")
  })

  it("aucun texte ne contient de chiffres hors du numéro d'ordre (donc aucun numéro de téléphone ou montant)", () => {
    for (const seq of [1, 7, 99]) {
      const texts = [purchaseMessageContent("purchase_request", seq), ...requests.PURCHASE_EVENTS.map((e) => purchaseMessageContent("purchase_event", seq, e))]
      for (const text of texts) {
        expect(text.replace(`N° ${seq}`, "")).not.toMatch(/\d/)
        expect(text).not.toMatch(/FCFA|vous touchez/i)
      }
    }
  })

  it.each([
    ["type inconnu", "text", 2, "paid"],
    ["type absent", undefined, 2, "paid"],
    ["événement inconnu", "purchase_event", 2, "refunded"],
    ["événement absent", "purchase_event", 2, undefined],
    ["numéro nul", "purchase_request", 0, undefined],
    ["numéro trop haut", "purchase_request", 100, undefined],
    ["numéro texte", "purchase_event", "2", "paid"],
  ])("null : %s", (_name, type, seq, event) => {
    expect(purchaseMessageContent(type, seq, event)).toBeNull()
  })

  it("isPurchaseMessageContent n'accepte que les textes fixes du bon type et du bon numéro", () => {
    expect(isPurchaseMessageContent("purchase_request", 2, "Demande de paiement d'achats N° 2")).toBe(true)
    expect(isPurchaseMessageContent("purchase_request", 3, "Demande de paiement d'achats N° 2")).toBe(false)
    expect(isPurchaseMessageContent("purchase_event", 2, "La demande N° 2 a été signalée.")).toBe(true)
    expect(isPurchaseMessageContent("purchase_event", 2, "Demande de paiement d'achats N° 2")).toBe(false)
    expect(isPurchaseMessageContent("purchase_request", 2, "La demande N° 2 a été signalée.")).toBe(false)
  })

  it.each([
    "Appelez le 01 97 12 34 56",
    "La demande N° 2 a été signalée. 01 97 12 34 56",
    "",
    "Demande de paiement d'achats N° 2 ",
    null,
    undefined,
    42,
  ])("refuse le contenu libre %j", (content) => {
    expect(isPurchaseMessageContent("purchase_request", 2, content)).toBe(false)
    expect(isPurchaseMessageContent("purchase_event", 2, content)).toBe(false)
  })

  it("type inconnu : jamais valide", () => {
    expect(isPurchaseMessageContent("text", 2, "Demande de paiement d'achats N° 2")).toBe(false)
  })
})

describe("createPurchaseSchema", () => {
  const parse = (override = {}) => createPurchaseSchema.safeParse({ ...validCreate, ...override })
  const messageOf = (result) => result.error.issues.map((i) => i.message).join(" | ")

  it("accepte une demande complète et normalise les champs", () => {
    const result = parse()
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      missionId: MISSION,
      requestId: REQUEST,
      payeeKind: "merchant",
      payeeNumber: "123456",
      payeePhotoPath: PATH_A,
      vendorName: "Poissonnerie Dossa",
      items: "Poisson fumé, crevettes",
      amount: 6000,
      ticketPhotoPath: PATH_B,
    })
  })

  it("normalise un numéro perso en +22901XXXXXXXX", () => {
    const result = parse({ payeeKind: "personal", payeeNumber: "01 97 12 34 56" })
    expect(result.data.payeeNumber).toBe("+2290197123456")
  })

  it("les articles sont facultatifs", () => {
    for (const items of [undefined, null, "", "   "]) {
      const result = parse({ items })
      expect(result.success).toBe(true)
      expect(result.data.items).toBeNull()
    }
  })

  it("bornes du montant : 100 et 500 000 passent, 99 et 500 001 non", () => {
    expect(parse({ amount: 100 }).success).toBe(true)
    expect(parse({ amount: 500000 }).success).toBe(true)
    expect(parse({ amount: 99 }).success).toBe(false)
    expect(parse({ amount: 500001 }).success).toBe(false)
    expect(messageOf(parse({ amount: 12.5 }))).toContain("nombre entier")
  })

  it("bornes du nom du vendeur : 2 à 80 caractères", () => {
    expect(parse({ vendorName: "Ab" }).success).toBe(true)
    expect(parse({ vendorName: "a".repeat(80) }).success).toBe(true)
    expect(parse({ vendorName: "A" }).success).toBe(false)
    expect(parse({ vendorName: " A " }).success).toBe(false)
    expect(parse({ vendorName: "a".repeat(81) }).success).toBe(false)
    expect(parse({ vendorName: "" }).success).toBe(false)
    expect(parse({ vendorName: undefined }).success).toBe(false)
  })

  it("bornes des articles : 120 caractères au plus", () => {
    expect(parse({ items: "a".repeat(120) }).success).toBe(true)
    expect(parse({ items: "a".repeat(121) }).success).toBe(false)
    expect(parse({ items: "a".repeat(5000) }).success).toBe(false)
  })

  it("réduit les espaces et retire les caractères de contrôle et de formatage", () => {
    const result = parse({ vendorName: "  Chez \n\t  Awa\u0000​  ", items: "riz‮   maïs" })
    expect(result.data.vendorName).toBe("Chez Awa")
    expect(result.data.items).toBe("riz maïs")
  })

  it("garde le HTML comme du texte (l'affichage l'échappe)", () => {
    const result = parse({ vendorName: "<script>alert(1)</script>" })
    expect(result.success).toBe(true)
    expect(result.data.vendorName).toBe("<script>alert(1)</script>")
  })

  it("exige le type et un numéro valide pour ce type", () => {
    expect(parse({ payeeKind: "other" }).success).toBe(false)
    expect(parse({ payeeKind: undefined }).success).toBe(false)
    const bad = parse({ payeeKind: "personal", payeeNumber: "123456" })
    expect(bad.success).toBe(false)
    expect(bad.error.issues[0].path).toEqual(["payeeNumber"])
    expect(parse({ payeeNumber: undefined }).success).toBe(false)
    expect(parse({ payeeNumber: "0197123456" }).success).toBe(false)
  })

  it("exige les deux photos", () => {
    expect(parse({ payeePhotoPath: "" }).success).toBe(false)
    expect(parse({ payeePhotoPath: undefined }).success).toBe(false)
    expect(parse({ ticketPhotoPath: "" }).success).toBe(false)
    expect(parse({ ticketPhotoPath: "a".repeat(201) }).success).toBe(false)
    expect(parse({ ticketPhotoPath: 12 }).success).toBe(false)
  })

  it("refuse les identifiants forgés", () => {
    for (const id of ["", "abc", "../etc", `${MISSION}/x`, 12, null, undefined]) {
      expect(parse({ missionId: id }).success).toBe(false)
      expect(parse({ requestId: id }).success).toBe(false)
    }
  })

  it("jette les champs inconnus : statut, version et identités ne se forgent pas", () => {
    const result = parse({ status: "paid", version: 9, studentId: STUDENT, clientId: STUDENT, paidAt: "2026-01-01", seq: 5 })
    expect(result.success).toBe(true)
    for (const key of ["status", "version", "studentId", "clientId", "paidAt", "seq"]) expect(result.data).not.toHaveProperty(key)
  })

  it("des messages d'erreur vouvoyés", () => {
    const messages = createPurchaseSchema.safeParse({}).error.issues.map((i) => i.message)
    expect(messages.length).toBeGreaterThanOrEqual(6)
    for (const message of messages) {
      expect(message).not.toMatch(/\b(?:tu|toi|ton|ta|tes|te)\b/i)
      expect(message).not.toContain(EM_DASH)
    }
  })

  it("refuse une entrée qui n'est pas un objet", () => {
    for (const input of [null, undefined, "x", 5, []]) expect(createPurchaseSchema.safeParse(input).success).toBe(false)
  })
})

describe("editPurchaseSchema", () => {
  const edit = { ...validCreate, expectedVersion: 2 }
  delete edit.missionId

  it("exige la version lue", () => {
    expect(editPurchaseSchema.safeParse(edit).success).toBe(true)
    for (const v of [undefined, 0, -1, 1.5, "2", null, NaN]) {
      expect(editPurchaseSchema.safeParse({ ...edit, expectedVersion: v }).success, String(v)).toBe(false)
    }
  })

  it("revalide tout le contenu, numéro compris", () => {
    expect(editPurchaseSchema.safeParse({ ...edit, amount: 50 }).success).toBe(false)
    expect(editPurchaseSchema.safeParse({ ...edit, payeeNumber: "12" }).success).toBe(false)
    expect(editPurchaseSchema.safeParse({ ...edit, payeeKind: "personal", payeeNumber: "0197123456" }).data.payeeNumber).toBe(
      "+2290197123456",
    )
  })
})

describe("purchaseVersionSchema (annuler, confirmer la réception)", () => {
  it("demande l'identifiant et la version", () => {
    expect(purchaseVersionSchema.safeParse({ requestId: REQUEST, expectedVersion: 1 }).success).toBe(true)
    expect(purchaseVersionSchema.safeParse({ requestId: REQUEST }).success).toBe(false)
    expect(purchaseVersionSchema.safeParse({ expectedVersion: 1 }).success).toBe(false)
    expect(purchaseVersionSchema.safeParse({ requestId: "x", expectedVersion: 1 }).success).toBe(false)
  })
})

describe("markPaidSchema", () => {
  const paid = {
    requestId: REQUEST,
    expectedVersion: 1,
    smsPhotoPath: `${MISSION}/${REQUEST}/sms-a1b2c3d4e5.png`,
    beneficiaryConfirmed: true,
    paidReference: "MP-0436-1",
  }
  const parse = (override = {}) => markPaidSchema.safeParse({ ...paid, ...override })

  it("accepte un paiement complet", () => {
    expect(parse().data).toMatchObject({ requestId: REQUEST, beneficiaryConfirmed: true, paidReference: "MP-0436-1" })
  })

  it("la capture est obligatoire", () => {
    expect(parse({ smsPhotoPath: undefined }).success).toBe(false)
    expect(parse({ smsPhotoPath: "" }).success).toBe(false)
    expect(parse({ smsPhotoPath: null }).success).toBe(false)
  })

  it("la case du bénéficiaire doit être exactement true", () => {
    for (const v of [false, undefined, null, "true", 1, "on"]) {
      const result = parse({ beneficiaryConfirmed: v })
      expect(result.success, String(v)).toBe(false)
      expect(result.error.issues[0].message).toContain("bénéficiaire")
    }
  })

  it("la référence est facultative", () => {
    for (const ref of [undefined, null, "", "   "]) {
      const result = parse({ paidReference: ref })
      expect(result.success).toBe(true)
      expect(result.data.paidReference).toBeNull()
    }
  })

  it("référence : lettres, chiffres et tirets, 40 au plus", () => {
    expect(parse({ paidReference: "a".repeat(40) }).success).toBe(true)
    expect(parse({ paidReference: "a".repeat(41) }).success).toBe(false)
    for (const bad of ["MP 0436", "MP_0436", "MP/0436", "<b>", "é", "1;2", 12, {}]) {
      expect(parse({ paidReference: bad }).success, String(bad)).toBe(false)
    }
  })

  it("exige la version et l'identifiant", () => {
    expect(parse({ expectedVersion: undefined }).success).toBe(false)
    expect(parse({ requestId: "x" }).success).toBe(false)
  })
})

describe("reportPurchaseSchema", () => {
  const report = { requestId: REQUEST, reason: "purchase_vendor_not_paid", details: "Le vendeur dit n'avoir rien reçu." }
  const parse = (override = {}) => reportPurchaseSchema.safeParse({ ...report, ...override })

  it("accepte chaque motif d'achats et « Autre »", () => {
    for (const { value } of PURCHASE_REPORT_REASONS) expect(parse({ reason: value }).success, value).toBe(true)
  })

  it("refuse un motif de la messagerie ou inconnu", () => {
    for (const reason of ["scam", "harassment", "contact_details", "", undefined, null, "purchase_other"]) {
      expect(parse({ reason }).success, String(reason)).toBe(false)
    }
  })

  it("explication de 10 à 1 000 caractères", () => {
    expect(parse({ details: "a".repeat(10) }).success).toBe(true)
    expect(parse({ details: "a".repeat(1000) }).success).toBe(true)
    expect(parse({ details: "a".repeat(9) }).success).toBe(false)
    expect(parse({ details: "a".repeat(1001) }).success).toBe(false)
    expect(parse({ details: "" }).success).toBe(false)
    expect(parse({ details: "         " }).success).toBe(false)
    expect(parse({ details: undefined }).success).toBe(false)
    expect(parse({ details: 12345678901 }).success).toBe(false)
  })

  it("les espaces autour ne comptent pas, les retours à la ligne sont conservés", () => {
    expect(parse({ details: `  ${"a".repeat(9)}  ` }).success).toBe(false)
    const result = parse({ details: "Premier\r\nsecond  mot\u0000​\n\n\ntroisième" })
    expect(result.data.details).toBe("Premier\nsecond mot\n\n\ntroisième")
  })

  it("exige l'identifiant de la demande", () => {
    expect(parse({ requestId: undefined }).success).toBe(false)
    expect(parse({ requestId: "../x" }).success).toBe(false)
  })

  it("jette l'auteur et le destinataire forgés", () => {
    const result = parse({ reporterId: STUDENT, reportedUserId: STUDENT, status: "resolved" })
    expect(result.data).not.toHaveProperty("reporterId")
    expect(result.data).not.toHaveProperty("status")
  })
})
