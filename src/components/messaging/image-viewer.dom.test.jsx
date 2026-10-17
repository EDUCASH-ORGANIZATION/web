// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- vignettes de test, adresses signées fictives */

import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { fireEvent, render, screen } from "@testing-library/react"
import { Enlargeable, VIEWER_ERROR_TEXT } from "./image-viewer"
import { PurchaseCard as ClientCard } from "@/components/client-space/messages/purchase/purchase-card"
import { PurchaseCard as StudentCard } from "@/components/student-space/messages/purchase/purchase-card"
import { Bubble as ClientBubble } from "@/components/client-space/messages/bubble"
import { Bubble as StudentBubble } from "@/components/student-space/messages/bubble"

const URLS = {
  payee: "https://signed.test/payee.jpg?token=a",
  ticket: "https://signed.test/ticket.jpg?token=b",
  sms: "https://signed.test/sms.jpg?token=c",
}

const clientRequest = (overrides = {}) => ({
  id: "6f1c2a52-8f3e-4c1d-9a55-0d3b6e4a7c10",
  seq: 2,
  status: "pending",
  version: 1,
  amount: 6200,
  vendorName: "Boutique Sœur Odile",
  items: "Riz",
  payeeKind: "merchant",
  payeeNumber: "4521",
  payeePhotoUrl: URLS.payee,
  ticketPhotoUrl: URLS.ticket,
  smsPhotoUrl: URLS.sms,
  createdAt: "2026-10-17T10:15:00Z",
  alreadyReportedByMe: false,
  ...overrides,
})

const viewerImage = () => screen.getByRole("dialog").querySelector("img")

// Chaque vignette de preuve : un vrai bouton nommé, qui ouvre la bonne image en grand, Échap ferme, le focus revient.
function checkProofs(renderCard) {
  const proofs = [
    ["Agrandir la photo du numéro marchand", URLS.payee, "Numéro marchand"],
    ["Agrandir la photo du ticket", URLS.ticket, "Ticket ou articles"],
    ["Agrandir la photo de la capture du SMS", URLS.sms, "Capture du SMS"],
  ]
  for (const [name, url, caption] of proofs) {
    const { unmount } = renderCard()
    const trigger = screen.getByRole("button", { name })
    expect(trigger.getAttribute("type")).toBe("button")
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(viewerImage().getAttribute("src")).toBe(url)
    expect(viewerImage().getAttribute("alt")).toBe(caption)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
    unmount()
  }
}

describe("Enlargeable", () => {
  it("ouvre la visionneuse, propose un nouvel onglet sécurisé, ferme par le bouton Fermer et par le voile", () => {
    render(
      <Enlargeable url={URLS.ticket} caption="Ticket" label="Agrandir la photo du ticket">
        <img src={URLS.ticket} alt="" />
      </Enlargeable>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Agrandir la photo du ticket" }))
    const link = screen.getByRole("link", { name: "Ouvrir dans un nouvel onglet" })
    expect(link.getAttribute("href")).toBe(URLS.ticket)
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" }).at(-1))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("ferme par le voile", () => {
    render(
      <Enlargeable url={URLS.ticket} caption="Ticket" label="Agrandir la photo du ticket">
        <img src={URLS.ticket} alt="" />
      </Enlargeable>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Agrandir la photo du ticket" }))
    const scrim = screen.getByRole("dialog").parentElement
    fireEvent.pointerDown(scrim)
    fireEvent.click(scrim)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("image en échec : message de renouvellement et rappel onError", () => {
    const onError = vi.fn()
    render(
      <Enlargeable url={URLS.ticket} caption="Ticket" label="Agrandir la photo du ticket" onError={onError}>
        <img src={URLS.ticket} alt="" />
      </Enlargeable>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Agrandir la photo du ticket" }))
    fireEvent.error(viewerImage())
    expect(screen.getByText(VIEWER_ERROR_TEXT)).toBeTruthy()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it("sans adresse : aucune vignette cliquable", () => {
    render(
      <Enlargeable url={null} caption="Ticket" label="Agrandir la photo du ticket">
        <span>Photo indisponible</span>
      </Enlargeable>,
    )
    expect(screen.queryByRole("button")).toBeNull()
  })
})

describe("preuves de la carte client", () => {
  it("chaque vignette s'ouvre en grand avec la bonne image", () => {
    checkProofs(() => render(<ClientCard request={clientRequest()} studentName="Ulrich" missionStatus="in_progress" />))
  })

  it("une photo en échec dans la visionneuse renouvelle l'adresse via onPhotoError", () => {
    const onPhotoError = vi.fn()
    render(<ClientCard request={clientRequest()} studentName="Ulrich" missionStatus="in_progress" onPhotoError={onPhotoError} />)
    fireEvent.click(screen.getByRole("button", { name: "Agrandir la photo du ticket" }))
    fireEvent.error(viewerImage())
    expect(onPhotoError).toHaveBeenCalledWith("6f1c2a52-8f3e-4c1d-9a55-0d3b6e4a7c10", "ticket")
  })

  it("une photo en échec dans la visionneuse laisse la boîte ouverte avec le message d'erreur", () => {
    const onPhotoError = vi.fn()
    render(<ClientCard request={clientRequest()} studentName="Ulrich" missionStatus="in_progress" onPhotoError={onPhotoError} />)
    const trigger = screen.getByRole("button", { name: "Agrandir la photo du ticket" })
    fireEvent.click(trigger)
    fireEvent.error(viewerImage())
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByText(VIEWER_ERROR_TEXT)).toBeTruthy()
    expect(onPhotoError).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Agrandir la photo du ticket" })).toBe(trigger)
  })

  it("une vignette indisponible n'est pas un bouton", () => {
    render(<ClientCard request={clientRequest({ payeePhotoUrl: null, smsPhotoUrl: null })} studentName="Ulrich" missionStatus="in_progress" />)
    expect(screen.getByText("Photo indisponible")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /numéro marchand/ })).toBeNull()
    expect(screen.getByRole("button", { name: "Agrandir la photo du ticket" })).toBeTruthy()
  })

  it("le panneau d'un vendeur sans numéro marchand porte son propre libellé", () => {
    render(<ClientCard request={clientRequest({ payeeKind: "personal" })} studentName="Ulrich" missionStatus="in_progress" />)
    expect(screen.getByRole("button", { name: "Agrandir la photo du panneau du vendeur" })).toBeTruthy()
  })
})

describe("visionneuse sous la racine de l'espace", () => {
  it("reste dans la racine .c2 (client) et .e2 (étudiant), sans portail vers body", () => {
    for (const root of ["ds c2", "ds e2"]) {
      const { unmount } = render(
        <div className={root}>
          <Enlargeable url={URLS.ticket} caption="Ticket" label="Agrandir la photo du ticket">
            <img src={URLS.ticket} alt="" />
          </Enlargeable>
        </div>,
      )
      fireEvent.click(screen.getByRole("button", { name: "Agrandir la photo du ticket" }))
      expect(screen.getByRole("dialog").closest(`.${root.split(" ")[1]}`)).not.toBeNull()
      unmount()
    }
  })
})

describe("preuves de la carte étudiant", () => {
  const studentRequest = (overrides = {}) => ({
    id: "11111111-1111-4111-8111-111111111111",
    seq: 3,
    status: "pending",
    vendorName: "Poissonnerie Dossa",
    items: "Poisson",
    amount: 6000,
    payeeKind: "merchant",
    payeeNumber: "4521",
    payeePhotoUrl: URLS.payee,
    ticketPhotoUrl: URLS.ticket,
    smsPhotoUrl: URLS.sms,
    sentAt: "2026-10-08T10:05:00Z",
    ...overrides,
  })

  it("chaque vignette s'ouvre en grand avec la bonne image", () => {
    const names = [
      ["Agrandir la photo du numéro de paiement", URLS.payee],
      ["Agrandir la photo du ticket", URLS.ticket],
      ["Agrandir la photo de la capture du SMS", URLS.sms],
    ]
    for (const [name, url] of names) {
      const { unmount } = render(<StudentCard request={studentRequest({ status: "paid" })} clientName="Afiavi" />)
      const trigger = screen.getByRole("button", { name })
      trigger.focus()
      fireEvent.click(trigger)
      expect(viewerImage().getAttribute("src")).toBe(url)
      fireEvent.keyDown(document, { key: "Escape" })
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(document.activeElement).toBe(trigger)
      unmount()
    }
  })

  it("une photo en échec (vignette ou visionneuse) demande le renouvellement des adresses", () => {
    const onPhotoError = vi.fn()
    render(<StudentCard request={studentRequest({ status: "paid" })} clientName="Afiavi" onPhotoError={onPhotoError} />)
    const trigger = screen.getByRole("button", { name: "Agrandir la photo du ticket" })
    fireEvent.error(trigger.querySelector("img"))
    expect(onPhotoError).toHaveBeenLastCalledWith("11111111-1111-4111-8111-111111111111")
    fireEvent.click(trigger)
    fireEvent.error(viewerImage())
    expect(onPhotoError).toHaveBeenCalledTimes(2)
    expect(screen.getByText(VIEWER_ERROR_TEXT)).toBeTruthy()
  })

  it("sans photo, la vignette garde son icône et n'est pas un bouton", () => {
    render(<StudentCard request={studentRequest({ payeePhotoUrl: null, ticketPhotoUrl: null, smsPhotoUrl: null })} clientName="Afiavi" />)
    expect(screen.queryByRole("button", { name: /^Agrandir/ })).toBeNull()
  })
})

describe("photos ordinaires de la messagerie", () => {
  const message = { id: "m-1", type: "image", mine: false, mediaUrl: URLS.ticket, createdAt: "2026-10-17T10:00:00Z" }

  for (const [label, Bubble] of [
    ["client", ClientBubble],
    ["étudiant", StudentBubble],
  ]) {
    it(`l'image d'une bulle ${label} s'ouvre en grand et le focus revient à la photo`, () => {
      render(<Bubble message={message} senderName="Awa K." />)
      const trigger = screen.getByRole("button", { name: "Agrandir l'image envoyée" })
      trigger.focus()
      fireEvent.click(trigger)
      expect(viewerImage().getAttribute("src")).toBe(URLS.ticket)
      fireEvent.keyDown(document, { key: "Escape" })
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(document.activeElement).toBe(trigger)
    })

    it(`une image sans adresse reste un texte, sans bouton (${label})`, () => {
      render(<Bubble message={{ ...message, mediaUrl: null }} senderName="Awa K." />)
      expect(screen.getByText("Image indisponible")).toBeTruthy()
      expect(screen.queryByRole("button", { name: /^Agrandir/ })).toBeNull()
    })
  }
})
