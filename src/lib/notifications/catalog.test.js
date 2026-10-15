import { describe, it, expect } from "vitest"
import { formatAmount } from "../app/format.js"
import { OTHER_REASON } from "../admin-space/decision-schemas.js"
import {
  NOTIFICATION_TYPES,
  TITLE_MAX,
  BODY_MAX,
  truncate,
  shortName,
  applicationReceived,
  applicationAccepted,
  applicationRejected,
  missionCancelled,
  paymentReleased,
  reviewReceived,
  verificationApproved,
  verificationRejected,
  verificationReset,
  badgeRevoked,
  accountReactivated,
  cardSubmitted,
  isValidNotification,
  notificationHref,
  isInternalPath,
  notificationIcon,
  notificationActionLabel,
  notificationTone,
  primaryNotificationId,
  groupNotifications,
  emptyNotificationsText,
  OTHER_REASON_LABEL,
} from "./catalog.js"

const DASHES = String.fromCharCode(0x2014, 0x2013)
const M = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const A = "1c9f2d2e-3d2c-4c64-8b63-0e7c7b7a4b21"
const S = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"

function allBuilt() {
  return [
    applicationReceived({ missionId: M, missionTitle: "Traduction d'un flyer", studentId: S, studentName: "Afiavi Dossou" }),
    applicationAccepted({ missionId: M, missionTitle: "Traduction d'un flyer", clientId: A, clientName: "Rosine Hounkpatin", studentId: S }),
    applicationRejected({ missionId: M, missionTitle: "Traduction d'un flyer", clientId: A, studentId: S }),
    missionCancelled({ missionId: M, missionTitle: "Traduction d'un flyer", clientId: A }),
    paymentReleased({ missionId: M, missionTitle: "Traduction d'un flyer", clientId: A, amount: 22000 }),
    reviewReceived({ missionId: M, missionTitle: "Traduction d'un flyer", reviewerId: A, reviewerName: "Rosine Hounkpatin" }),
    verificationApproved({ verifiedUntil: "2027-06-29" }),
    verificationRejected({ reasonLabel: "Photo floue ou illisible", fingerprint: "a1b2c3d4e5f6" }),
    verificationReset({ fingerprint: "a1b2c3d4e5f6" }),
    badgeRevoked({ at: new Date("2026-10-15T10:00:00Z") }),
    accountReactivated({ at: new Date("2026-10-15T10:00:00Z") }),
    cardSubmitted({ studentId: S, studentName: "Codjo Agbo", at: new Date("2026-10-15T10:00:00Z") }),
  ]
}

describe("catalogue des notifications", () => {
  it("la liste des types est figée (même liste que le CHECK de la table)", () => {
    expect([...NOTIFICATION_TYPES]).toEqual([
      "application_received",
      "application_accepted",
      "application_rejected",
      "mission_cancelled",
      "payment_released",
      "review_received",
      "verification_approved",
      "verification_rejected",
      "verification_reset",
      "badge_revoked",
      "account_reactivated",
      "card_submitted",
      "message_received",
    ])
  })

  it("produit les textes exacts du tableau des producteurs", () => {
    const [received, accepted, rejected, cancelled, released, review, approved, refused, reset, revoked, reactivated, card] = allBuilt()
    expect(received).toMatchObject({
      type: "application_received",
      title: "Nouvelle candidature",
      body: "Afiavi D. a postulé à « Traduction d'un flyer ».",
      dedupeKey: `application_received:${M}:${S}`,
      missionId: M,
      actorId: S,
    })
    expect(accepted.body).toBe("Rosine H. vous a retenu pour « Traduction d'un flyer ». La mission démarre.")
    expect(accepted.dedupeKey).toBe(`application_accepted:${M}:${S}`)
    expect(rejected.body).toBe("Votre candidature à « Traduction d'un flyer » n'a pas été retenue.")
    expect(cancelled.body).toBe("La mission « Traduction d'un flyer » a été annulée par le client.")
    expect(cancelled.dedupeKey).toBe(`mission_cancelled:${M}`)
    expect(released.title).toBe(`Paiement reçu : ${formatAmount(22000, { sign: "credit" })}`)
    expect(released.body).toBe("Le client a validé « Traduction d'un flyer ».")
    expect(released.dedupeKey).toBe(`payment_released:${M}`)
    expect(review.body).toBe("Rosine H. vous a laissé un avis sur « Traduction d'un flyer ».")
    expect(approved.title).toBe("Profil vérifié")
    expect(approved.body).toBe("Votre badge est valable jusqu'au 29 juin 2027.")
    expect(approved.dedupeKey).toBe("verification_approved:2027-06-29")
    expect(refused.body).toBe("Motif : photo floue ou illisible. Vous pouvez envoyer une nouvelle carte.")
    expect(refused.dedupeKey).toBe("verification_rejected:a1b2c3d4e5f6")
    expect(reset.dedupeKey).toBe("verification_reset:a1b2c3d4e5f6")
    expect(reset.body).toBe("Le refus de votre carte a été levé.")
    expect(revoked.body).toBe("Votre badge vérifié a été retiré. Consultez votre profil pour en savoir plus.")
    expect(reactivated.body).toBe("Vous pouvez de nouveau utiliser EduCash.")
    expect(card).toMatchObject({
      title: "Nouveau dossier à examiner",
      body: "Codjo A. a envoyé sa carte étudiante.",
      dedupeKey: `card_submitted:${S}:2026-10-15`,
    })
  })

  it("payment_released : montant inconnu, nul ou négatif => titre générique, jamais « + 0 FCFA »", () => {
    for (const amount of [undefined, null, 0, 0.4, -500, Number.NaN, Number.POSITIVE_INFINITY, "22000", {}]) {
      const n = paymentReleased({ missionId: M, missionTitle: "Flyer", clientId: A, amount })
      expect(n.title, String(amount)).toBe("Paiement reçu")
      expect(n.title).not.toMatch(/FCFA|\d/)
      expect(isValidNotification(n)).toBe(true)
    }
    expect(paymentReleased({ missionId: M, missionTitle: "Flyer", clientId: A, amount: 1 }).title)
      .toBe(`Paiement reçu : ${formatAmount(1, { sign: "credit" })}`)
  })

  it("verification_rejected « Autre motif » : pas de phrase Motif, l'invitation à renvoyer reste", () => {
    expect(OTHER_REASON_LABEL).toBe(OTHER_REASON)
    const n = verificationRejected({ reasonLabel: OTHER_REASON, fingerprint: "a1b2c3d4e5f6" })
    expect(n.body).toBe("Vous pouvez envoyer une nouvelle carte.")
    expect(n.body).not.toMatch(/motif/i)
    expect(verificationRejected({ reasonLabel: "Photo floue ou illisible", fingerprint: "a1b2c3d4e5f6" }).body)
      .toBe("Motif : photo floue ou illisible. Vous pouvez envoyer une nouvelle carte.")
  })

  it("verification_rejected / verification_reset : la clé ne recopie jamais une date de dépôt brute", () => {
    const raw = "2026-10-14T09:00:00.123456+00:00"
    for (const n of [
      verificationRejected({ reasonLabel: "Photo floue ou illisible", fingerprint: raw, submittedAt: raw }),
      verificationReset({ fingerprint: raw, token: raw }),
      verificationRejected({ reasonLabel: "Photo floue ou illisible" }),
      verificationReset({}),
    ]) {
      expect(n.dedupeKey).toMatch(/^verification_(rejected|reset):t[0-9a-z]+$/)
      expect(n.dedupeKey).not.toMatch(/2026|T09|:00/)
    }
  })

  it("chaque texte est vouvoyé, sans tiret cadratin ni mot banni", () => {
    const banned = new RegExp(`[${DASHES}]|fedapay|j'ai terminé|72 h|bientôt|livraison|\\btu\\b|\\btoi\\b|\\bton\\b|\\bta\\b|\\btes\\b`, "i")
    for (const n of allBuilt()) {
      expect(`${n.title} ${n.body}`, n.type).not.toMatch(banned)
      expect(isValidNotification(n), n.type).toBe(true)
    }
  })

  it("tronque proprement et borne titre et corps", () => {
    const long = "x".repeat(500)
    expect(truncate(long, 10)).toBe("xxxxxxx...")
    const n = applicationReceived({ missionId: M, missionTitle: long, studentId: S, studentName: long })
    expect(Array.from(n.title).length).toBeLessThanOrEqual(TITLE_MAX)
    expect(Array.from(n.body).length).toBeLessThanOrEqual(BODY_MAX)
    expect(n.body.includes("...")).toBe(true)
  })

  it("noms au format Prénom I. et repli neutre", () => {
    expect(shortName("Afiavi  Dossou", "Un étudiant")).toBe("Afiavi D.")
    expect(shortName("Afiavi", "Un étudiant")).toBe("Afiavi")
    expect(shortName("", "Un étudiant")).toBe("Un étudiant")
    expect(shortName(null, "Le client")).toBe("Le client")
  })

  it("une valeur hostile reste du texte et les sauts de ligne sont aplatis", () => {
    const n = applicationReceived({
      missionId: M,
      missionTitle: "<script>alert(1)</script>\nsuite",
      studentId: S,
      studentName: "<img src=x onerror=alert(1)> Dossou",
    })
    expect(n.body).toContain("<script>alert(1)</script> suite")
    expect(n.body).not.toContain("\n")
    expect(n.body.startsWith("<img D. a postulé")).toBe(true)
  })

  it("les clés d'idempotence sont stables", () => {
    const a = cardSubmitted({ studentId: S, studentName: "X Y", at: new Date("2026-10-15T08:00:00Z") })
    const b = cardSubmitted({ studentId: S, studentName: "X Y", at: new Date("2026-10-15T20:00:00Z") })
    const c = cardSubmitted({ studentId: S, studentName: "X Y", at: new Date("2026-10-16T08:00:00Z") })
    expect(a.dedupeKey).toBe(b.dedupeKey)
    expect(a.dedupeKey).not.toBe(c.dedupeKey)
  })

  it("jour du Bénin pour la clé card_submitted (23 h 30 UTC = lendemain à Cotonou)", () => {
    const n = cardSubmitted({ studentId: S, studentName: "X Y", at: new Date("2026-10-15T23:30:00Z") })
    expect(n.dedupeKey).toBe(`card_submitted:${S}:2026-10-16`)
  })

  it("isValidNotification refuse un type inconnu, un titre vide, un identifiant non uuid", () => {
    const base = applicationReceived({ missionId: M, missionTitle: "T", studentId: S, studentName: "A B" })
    expect(isValidNotification({ ...base, type: "autre" })).toBe(false)
    expect(isValidNotification({ ...base, title: "" })).toBe(false)
    expect(isValidNotification({ ...base, dedupeKey: "" })).toBe(false)
    expect(isValidNotification({ ...base, missionId: "pas-un-uuid" })).toBe(false)
    expect(isValidNotification(null)).toBe(false)
  })

  it("un identifiant non uuid donné au constructeur est écarté", () => {
    const n = applicationReceived({ missionId: "x", missionTitle: "T", studentId: "y", studentName: "A B" })
    expect(n.missionId).toBeNull()
    expect(n.actorId).toBeNull()
  })
})

describe("liens recalculés à la lecture", () => {
  it("client : candidature, avis, accueil", () => {
    expect(notificationHref({ type: "application_received", mission_id: M, actor_id: S }, "client")).toBe(`/client/missions/${M}?candidat=${S}`)
    expect(notificationHref({ type: "review_received", mission_id: M }, "client")).toBe(`/client/missions/${M}`)
    expect(notificationHref({ type: "account_reactivated" }, "client")).toBe("/client/dashboard")
  })

  it("étudiant : mission, candidatures, avis à laisser, vérification", () => {
    expect(notificationHref({ type: "application_accepted", mission_id: M }, "student")).toBe(`/student/missions/${M}`)
    expect(notificationHref({ type: "application_rejected", mission_id: M }, "student")).toBe("/applications")
    expect(notificationHref({ type: "mission_cancelled", mission_id: M }, "student")).toBe("/applications")
    expect(notificationHref({ type: "payment_released", mission_id: M }, "student")).toBe(`/student/review/${M}`)
    expect(notificationHref({ type: "review_received", mission_id: M }, "student")).toBe("/profile")
    expect(notificationHref({ type: "badge_revoked" }, "student")).toBe("/profile")
    for (const type of ["verification_approved", "verification_rejected", "verification_reset"]) {
      expect(notificationHref({ type }, "student")).toBe("/profile/verify")
    }
  })

  it("admin : dossiers", () => {
    expect(notificationHref({ type: "card_submitted", actor_id: S }, "admin")).toBe("/admin/verifications")
  })

  it("un type d'un autre espace n'a pas de lien", () => {
    expect(notificationHref({ type: "card_submitted" }, "student")).toBeNull()
    expect(notificationHref({ type: "application_accepted", mission_id: M }, "client")).toBeNull()
    expect(notificationHref({ type: "application_received", mission_id: M }, "admin")).toBeNull()
    expect(notificationHref({ type: "inconnu" }, "client")).toBeNull()
    expect(notificationHref({ type: "card_submitted" }, "autre")).toBeNull()
  })

  it("jamais de redirection ouverte : identifiants hostiles écartés, chemins internes seulement", () => {
    const hostile = ["javascript:alert(1)", "//evil.example", "https://evil.example", "../../x", "a b"]
    for (const bad of hostile) {
      for (const space of ["client", "student", "admin"]) {
        for (const type of NOTIFICATION_TYPES) {
          const href = notificationHref({ type, mission_id: bad, actor_id: bad }, space)
          if (href !== null) expect(isInternalPath(href), `${type} ${space} ${bad}`).toBe(true)
          if (href !== null) expect(href).not.toMatch(/evil|javascript/)
        }
      }
    }
  })

  it("isInternalPath", () => {
    expect(isInternalPath("/client/missions")).toBe(true)
    expect(isInternalPath("//evil")).toBe(false)
    expect(isInternalPath("https://evil")).toBe(false)
    expect(isInternalPath("javascript:1")).toBe(false)
    expect(isInternalPath(null)).toBe(false)
  })
})

describe("présentation", () => {
  it("icône du sprite pour chaque type, neutre par défaut", () => {
    for (const type of NOTIFICATION_TYPES) expect(notificationIcon(type)).toMatch(/^i-[a-z-]+$/)
    expect(notificationIcon("inconnu")).toBe("i-bell")
    expect(notificationTone()).toBe("neutre")
  })

  it("libellés d'action", () => {
    expect(notificationActionLabel("application_received")).toBe("Voir la candidature")
    expect(notificationActionLabel("verification_rejected")).toBe("Envoyer une nouvelle carte")
    expect(notificationActionLabel("card_submitted")).toBe("Examiner")
    expect(notificationActionLabel("review_received")).toBeNull()
  })

  it("primaryNotificationId renvoie au plus un identifiant, une non lue prioritaire", () => {
    const items = [
      { id: "1", type: "review_received", read_at: null },
      { id: "2", type: "application_received", read_at: "2026-10-01T00:00:00Z" },
      { id: "3", type: "application_received", read_at: null },
      { id: "4", type: "application_received", read_at: null },
    ]
    expect(primaryNotificationId(items, "client")).toBe("3")
    expect(primaryNotificationId(items, "student")).toBeNull()
    expect(primaryNotificationId([], "admin")).toBeNull()
    expect(primaryNotificationId(null, "admin")).toBeNull()
    const student = [
      { id: "a", type: "verification_rejected", read_at: null },
      { id: "b", type: "application_accepted", read_at: null },
    ]
    expect(primaryNotificationId(student, "student")).toBe("b")
  })

  it("groupement Aujourd'hui / Plus tôt en date du Bénin", () => {
    const now = new Date("2026-10-15T12:00:00Z")
    const groups = groupNotifications(
      [
        { id: "a", created_at: "2026-10-15T08:00:00Z" },
        { id: "b", created_at: "2026-10-14T23:30:00Z" },
        { id: "c", created_at: "2026-10-14T22:30:00Z" },
        { id: "d", created_at: "pas une date" },
      ],
      now,
    )
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Aujourd'hui", ["a", "b"]],
      ["Plus tôt", ["c", "d"]],
    ])
    expect(groupNotifications([], now)).toEqual([])
  })

  it("textes d'état vide sans promesse de paiement ni de message", () => {
    for (const space of ["client", "student", "admin"]) {
      const text = emptyNotificationsText(space)
      expect(text).not.toMatch(/paiement|message|retrait/i)
      expect(text).not.toMatch(new RegExp(`[${DASHES}]`))
    }
  })
})
