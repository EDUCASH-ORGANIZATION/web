// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { PurchaseCard } from "./purchase-card"
import {
  PAYMENT_WARNING,
  PURCHASE_ESTIMATE_EXCEEDED_NOTE,
  PURCHASE_NO_REFUND_NOTE,
  PURCHASE_REVIEWED_LABEL,
} from "@/lib/purchases/requests"

// Les vignettes de preuve sont des boutons « Agrandir la photo ... » : les assertions sur les actions les écartent.
const actionButtons = () => screen.queryAllByRole("button").filter((b) => !/^Agrandir/.test(b.getAttribute("aria-label") ?? ""))

const ID = "6f1c2a52-8f3e-4c1d-9a55-0d3b6e4a7c10"

function request(overrides = {}) {
  return {
    id: ID,
    seq: 2,
    status: "pending",
    version: 1,
    amount: 6200,
    vendorName: "Boutique Sœur Odile",
    items: "Riz 5 kg, huile, savon",
    payeeKind: "personal",
    payeeNumber: "+2290196421841",
    payeePhotoUrl: "https://signed.test/payee.jpg?token=a",
    ticketPhotoUrl: "https://signed.test/ticket.jpg?token=b",
    smsPhotoUrl: null,
    createdAt: "2026-10-17T10:15:00Z",
    editedAt: null,
    paidAt: null,
    receivedAt: null,
    paidReference: null,
    alreadyReportedByMe: false,
    reportReason: null,
    reportReference: null,
    reviewed: false,
    ...overrides,
  }
}

function renderCard(props = {}) {
  const onMarkPaid = vi.fn()
  const onReport = vi.fn()
  const onPhotoError = vi.fn()
  const req = props.request ?? request()
  const view = render(
    <PurchaseCard
      request={req}
      studentName="Ulrich"
      missionStatus="in_progress"
      onMarkPaid={onMarkPaid}
      onReport={onReport}
      onPhotoError={onPhotoError}
      {...props}
    />,
  )
  return { ...view, onMarkPaid, onReport, onPhotoError, req }
}

const text = (container) => container.textContent.replace(/\s+/g, " ")

describe("PurchaseCard - en attente de paiement", () => {
  it("montre le vendeur, le numéro à payer, les articles, l'heure et le montant", () => {
    const { container } = renderCard()
    const card = screen.getByRole("article", { name: /Demande de paiement d'achats N° 2, Boutique Sœur Odile, 6.200.FCFA/ })
    expect(within(card).getByText("Demande de paiement")).toBeTruthy()
    const t = text(container)
    expect(t).toContain("N° 2 · Achats · Ulrich · 11:15")
    expect(t).toContain("En attente de paiement")
    expect(t).toContain("Boutique Sœur Odile")
    expect(t).toContain("+229 01 96 42 18 41 · Numéro MoMo personnel")
    expect(t).toContain("Riz 5 kg, huile, savon")
    expect(t).toContain("Montant total à payer")
    expect(container.querySelector(".c-payreq__total .amount").textContent).toMatch(/^6.200FCFA$/)
    expect(t).toContain("Panneau du vendeur")
    expect(t).toContain("Ticket ou articles")
    expect(t).toContain("n'a pas de numéro marchand")
  })

  it("affiche un code marchand avec la légende de la photo du numéro marchand", () => {
    const { container } = renderCard({ request: request({ payeeKind: "merchant", payeeNumber: "452187" }) })
    const t = text(container)
    expect(t).toContain("452187 · Numéro marchand MoMo")
    expect(t).toContain("Numéro marchand")
    expect(t).not.toContain("Panneau du vendeur")
    expect(t).not.toContain("n'a pas de numéro marchand")
  })

  it("affiche l'avertissement identique à PAYMENT_WARNING", () => {
    const { container } = renderCard()
    const warn = container.querySelector(".c-payreq__warn")
    expect(warn.getAttribute("role")).toBe("note")
    expect(warn.textContent).toBe(PAYMENT_WARNING)
  })

  it("n'a qu'un seul bouton encre, « Payé », et jamais « Confirmer et payer »", () => {
    const { container } = renderCard()
    const dark = container.querySelectorAll(".btn--dark")
    expect(dark).toHaveLength(1)
    expect(dark[0].textContent).toBe("Payé")
    expect(screen.queryByText(/Confirmer et payer/)).toBeNull()
    expect(screen.getByRole("button", { name: /Signaler/ }).className).toContain("btn--ghost")
  })

  it("« Payé » et « Signaler » appellent leurs callbacks avec la demande", () => {
    const { onMarkPaid, onReport, req } = renderCard()
    fireEvent.click(screen.getByRole("button", { name: "Marquer comme payé, demande N° 2" }))
    expect(onMarkPaid).toHaveBeenCalledWith(req)
    fireEvent.click(screen.getByRole("button", { name: "Signaler la demande N° 2" }))
    expect(onReport).toHaveBeenCalledWith(req)
  })

  it("indique la modification avec son heure, seulement quand elle existe", () => {
    const { container, rerender } = renderCard()
    expect(text(container)).not.toContain("Modifiée à")
    rerender(<PurchaseCard request={request({ editedAt: "2026-10-17T10:40:00Z", version: 2 })} studentName="Ulrich" missionStatus="in_progress" onMarkPaid={() => {}} />)
    expect(text(container)).toContain("Modifiée à 11:40")
  })

  it("affiche la note de dépassement sans bloquer le bouton « Payé »", () => {
    const { container } = renderCard({ estimateExceeded: true })
    expect(text(container)).toContain(PURCHASE_ESTIMATE_EXCEEDED_NOTE)
    expect(screen.getByRole("button", { name: /Marquer comme payé/ }).disabled).toBe(false)
  })

  it("n'affiche pas la note de dépassement par défaut", () => {
    const { container } = renderCard()
    expect(text(container)).not.toContain(PURCHASE_ESTIMATE_EXCEEDED_NOTE)
  })

  it("masque un bouton dont le callback manque et toute action hors des règles", () => {
    const { rerender } = renderCard({ onMarkPaid: undefined })
    expect(screen.queryByRole("button", { name: /Marquer comme payé/ })).toBeNull()
    expect(screen.getByRole("button", { name: /Signaler/ })).toBeTruthy()
    rerender(<PurchaseCard request={request()} studentName="Ulrich" missionStatus="inconnu" onMarkPaid={() => {}} onReport={() => {}} />)
    expect(actionButtons()).toHaveLength(0)
    rerender(<PurchaseCard request={request()} studentName="Ulrich" missionStatus="cancelled" onMarkPaid={() => {}} onReport={() => {}} />)
    expect(screen.queryByRole("button", { name: /Marquer comme payé/ })).toBeNull()
  })

  it("« Payé » reste possible sur une mission terminée (D5)", () => {
    renderCard({ missionStatus: "done" })
    expect(screen.getByRole("button", { name: /Marquer comme payé/ })).toBeTruthy()
  })
})

describe("PurchaseCard - photos", () => {
  it("affiche les photos signées en balises img simples, sans next/image", () => {
    const { container } = renderCard()
    const srcs = [...container.querySelectorAll(".c-shot img")].map((img) => img.getAttribute("src"))
    expect(srcs).toEqual(["https://signed.test/payee.jpg?token=a", "https://signed.test/ticket.jpg?token=b"])
    const source = readFileSync(join(process.cwd(), "src/components/client-space/messages/purchase/purchase-card.jsx"), "utf8")
    expect(source).not.toMatch(/from "next\/image"/)
  })

  it("remplace une photo manquante ou qui ne charge plus par un repli et prévient la vue", () => {
    const { container, onPhotoError, req } = renderCard({ request: request({ ticketPhotoUrl: null }) })
    expect(text(container)).toContain("Photo indisponible")
    const img = container.querySelector(".c-shot img")
    fireEvent.error(img)
    expect(onPhotoError).toHaveBeenCalledWith(req.id, "payee")
    expect(container.querySelectorAll(".c-shot img")).toHaveLength(0)
    expect(text(container).match(/Photo indisponible/g)).toHaveLength(2)
  })

  it("légende chaque photo (figcaption)", () => {
    const { container } = renderCard({ request: request({ status: "paid", smsPhotoUrl: "https://signed.test/sms.jpg", paidAt: "2026-10-17T10:22:00Z" }) })
    const captions = [...container.querySelectorAll("figcaption")].map((c) => c.textContent)
    expect(captions).toEqual(["Panneau du vendeur", "Ticket ou articles", "Capture du SMS"])
  })
})

describe("PurchaseCard - payé", () => {
  const paid = () => request({ status: "paid", version: 3, paidAt: "2026-10-17T10:22:00Z", smsPhotoUrl: "https://signed.test/sms.jpg", paidReference: "MP-0436-1" })

  it("annonce le paiement, attend l'étudiant et ne propose plus que « Signaler »", () => {
    const { container } = renderCard({ request: paid() })
    const t = text(container)
    expect(t).toContain("Payé")
    expect(t).toContain("Vous avez payé à 11:22. En attente de la confirmation de Ulrich")
    expect(t).toContain("Montant total")
    expect(t).not.toContain("Montant total à payer")
    expect(t).toContain("Réf. MP-0436-1")
    expect(container.querySelectorAll(".btn--dark")).toHaveLength(0)
    expect(screen.queryByRole("button", { name: /Marquer comme payé/ })).toBeNull()
    expect(screen.getByRole("button", { name: /Signaler/ })).toBeTruthy()
  })

  it("n'affiche plus l'avertissement avant paiement", () => {
    const { container } = renderCard({ request: paid() })
    expect(container.querySelector(".c-payreq__warn")).toBeNull()
  })
})

describe("PurchaseCard - reçu par le vendeur", () => {
  const received = () =>
    request({
      status: "received",
      paidAt: "2026-10-17T09:51:00Z",
      receivedAt: "2026-10-17T09:56:00Z",
      smsPhotoUrl: "https://signed.test/sms.jpg",
      paidReference: "MP-0436-1",
      amount: 7450,
    })

  it("est verrouillée : seul « Signaler » reste, avec l'heure du paiement et la référence", () => {
    const { container } = renderCard({ request: received() })
    const t = text(container)
    expect(t).toContain("Reçu par le vendeur")
    expect(t).toContain("Ulrich confirme à 10:56 : le vendeur a bien reçu")
    expect(t).toContain("Payé à 10:51 · réf. MP-0436-1")
    expect(actionButtons()).toHaveLength(1)
    expect(screen.getByRole("button", { name: /Signaler/ })).toBeTruthy()
    expect(container.querySelector(".c-payreq__warn")).toBeNull()
  })

  it("ne propose plus « Signaler » à qui a déjà signalé", () => {
    renderCard({ request: { ...received(), alreadyReportedByMe: true } })
    expect(actionButtons()).toHaveLength(0)
  })
})

describe("PurchaseCard - signalé", () => {
  const reported = (overrides = {}) =>
    request({
      status: "reported",
      paidAt: "2026-10-17T09:51:00Z",
      smsPhotoUrl: "https://signed.test/sms.jpg",
      alreadyReportedByMe: true,
      reportReason: "purchase_vendor_not_paid",
      reportReference: "SIG-0112",
      ...overrides,
    })

  it("a le cadre d'alerte, rappelle le motif et le suivi, sans promettre de remboursement", () => {
    const { container } = renderCard({ request: reported() })
    expect(container.querySelector(".c-payreq").className).toContain("c-payreq--flagged")
    const t = text(container)
    expect(t).toContain("Signalé")
    expect(t).toContain("Vous avez signalé cette demande : « Le vendeur n'a pas reçu l'argent ». Signalement SIG-0112.")
    expect(t).toContain(PURCHASE_NO_REFUND_NOTE)
    expect(t).not.toContain(PURCHASE_REVIEWED_LABEL)
    expect(actionButtons()).toHaveLength(0)
  })

  it("affiche « Examiné par l'équipe EduCash » sans lien quand le signalement est clos", () => {
    const { container } = renderCard({ request: reported({ reviewed: true }) })
    expect(text(container)).toContain(PURCHASE_REVIEWED_LABEL)
    expect(text(container)).not.toContain("examine les photos")
    expect(container.querySelector("a")).toBeNull()
  })

  it("signalée par l'autre partie : message neutre et « Signaler » encore possible (D6)", () => {
    const { container } = renderCard({ request: reported({ alreadyReportedByMe: false, reportReason: "other", reportReference: null }) })
    expect(text(container)).toContain("Cette demande a été signalée.")
    expect(text(container)).not.toContain("Vous avez signalé")
    expect(screen.getByRole("button", { name: /Signaler/ })).toBeTruthy()
  })
})

describe("PurchaseCard - annulée", () => {
  it("n'a aucune action ni avertissement de paiement", () => {
    const { container } = renderCard({ request: request({ status: "cancelled" }) })
    expect(text(container)).toContain("Annulée")
    expect(text(container)).toContain("Ulrich a annulé cette demande.")
    expect(actionButtons()).toHaveLength(0)
    expect(container.querySelector(".c-payreq__warn")).toBeNull()
  })
})

describe("PurchaseCard - robustesse", () => {
  it("reste lisible sans nom d'étudiant et avec un numéro invalide", () => {
    const { container } = renderCard({ studentName: undefined, request: request({ payeeNumber: "n'importe quoi", items: null }) })
    const t = text(container)
    expect(t).toContain("L'étudiant")
    expect(t).toContain("Non renseigné")
    expect(t).not.toContain("Articles")
  })

  it("échappe les textes du vendeur (pas de HTML interprété)", () => {
    const { container } = renderCard({ request: request({ vendorName: "<b>Odile</b>", items: "<script>alert(1)</script>" }) })
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("dd b")).toBeNull()
    expect(text(container)).toContain("<b>Odile</b>")
  })

  it("n'utilise ni style en ligne ni couleur en dur", () => {
    const { container } = renderCard({ estimateExceeded: true })
    expect(container.querySelectorAll("[style]")).toHaveLength(0)
  })
})
