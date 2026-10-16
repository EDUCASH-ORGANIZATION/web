// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { ContactWarning } from "./contact-warning"
import { MessagingNotice } from "./messaging-notice"
import { PlaceLinks } from "./place-links"
import { ReportDialog, submitReportOnce } from "./report-dialog"
import { ANALYSIS_NOTICE_COPY, CONTACT_WARNING_COPY, KEYWORD_WARNING_COPY, PRIVACY_MESSAGES_HREF } from "@/lib/messaging/contact-copy"
import { REPORT_REASONS } from "@/lib/messaging/moderation-rules"

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe("ContactWarning", () => {
  it("affiche le bandeau pour un numéro", () => {
    render(<ContactWarning text="Appelez-moi au 01 97 12 34 56" />)
    const banner = screen.getByRole("status")
    expect(banner.textContent).toBe(CONTACT_WARNING_COPY)
    expect(banner.className).toContain("banner--info")
  })

  it("affiche le texte des mots-clés sans coordonnée", () => {
    render(<ContactWarning text="Écrivez-moi sur whatsapp" />)
    expect(screen.getByRole("status").textContent).toBe(KEYWORD_WARNING_COPY)
  })

  it("n'affiche rien pour un texte ordinaire, vide ou absent", () => {
    const { container, rerender } = render(<ContactWarning text="Bonjour, à demain" />)
    expect(container.innerHTML).toBe("")
    rerender(<ContactWarning text="   " />)
    expect(container.innerHTML).toBe("")
    rerender(<ContactWarning />)
    expect(container.innerHTML).toBe("")
  })

  it("réagit au changement de texte", () => {
    const { rerender } = render(<ContactWarning text="Bonjour" />)
    expect(screen.queryByRole("status")).toBeNull()
    rerender(<ContactWarning text="mon mail a.b@example.com" />)
    expect(screen.getByRole("status")).toBeTruthy()
  })
})

describe("MessagingNotice", () => {
  it("annonce l'analyse automatique avec le lien de confidentialité", () => {
    render(<MessagingNotice />)
    expect(screen.getByText(new RegExp(ANALYSIS_NOTICE_COPY.slice(0, 40)))).toBeTruthy()
    expect(screen.getByRole("link", { name: "En savoir plus" }).getAttribute("href")).toBe(PRIVACY_MESSAGES_HREF)
  })
})

describe("PlaceLinks", () => {
  it("construit les deux liens à partir des coordonnées", () => {
    render(<PlaceLinks lat={6.3703} lng={2.3912} />)
    const place = screen.getByRole("link", { name: "Ouvrir dans Google Maps" })
    const route = screen.getByRole("link", { name: "Itinéraire" })
    expect(place.getAttribute("href")).toBe("https://www.google.com/maps/search/?api=1&query=6.3703,2.3912")
    expect(route.getAttribute("href")).toBe("https://www.google.com/maps/dir/?api=1&destination=6.3703,2.3912")
    for (const a of [place, route]) {
      expect(a.getAttribute("target")).toBe("_blank")
      expect(a.getAttribute("rel")).toBe("noopener noreferrer")
    }
  })

  it("applique la classe de lien demandée", () => {
    render(<PlaceLinks lat={6.37} lng={2.39} linkClassName="ds-place-link" />)
    expect(screen.getByRole("link", { name: "Itinéraire" }).className).toBe("ds-place-link")
  })

  it("indique que la position est indisponible si les coordonnées sont invalides", () => {
    for (const [lat, lng] of [[NaN, 2], [91, 2], ["6.3", "2.3"], [undefined, undefined]]) {
      const { unmount } = render(<PlaceLinks lat={lat} lng={lng} />)
      expect(screen.getByText("Position indisponible")).toBeTruthy()
      expect(screen.queryByRole("link")).toBeNull()
      unmount()
    }
  })
})

describe("ReportDialog", () => {
  it.each([
    ["Afiavi D.", "L'équipe examinera ce message de Afiavi D. La personne"],
    ["Sèna", "L'équipe examinera ce message de Sèna. La personne"],
    ["", "L'équipe examinera ce message. La personne"],
    [undefined, "L'équipe examinera ce message. La personne"],
  ])("ponctuation de l'en-tête sans double point (nom %j)", (name, expected) => {
    const { container } = render(<ReportDialog senderName={name} onSubmit={vi.fn()} onClose={vi.fn()} />)
    const text = (document.body.textContent || container.textContent).replace(/\s+/g, " ")
    expect(text).toContain(expected)
    expect(text).not.toContain("..")
  })

  const open = (onSubmit = vi.fn(), onClose = vi.fn()) => {
    render(<ReportDialog senderName="Sèna" onSubmit={onSubmit} onClose={onClose} />)
    return { onSubmit, onClose }
  }

  it("liste les motifs et la mention d'anonymat", () => {
    open()
    expect(screen.getByRole("dialog", { name: "Signaler un problème" })).toBeTruthy()
    for (const r of REPORT_REASONS) expect(screen.getByRole("radio", { name: r.label })).toBeTruthy()
    expect(screen.getByText(/La personne ne saura pas qui a signalé\./)).toBeTruthy()
    expect(screen.getByText(/de Sèna/)).toBeTruthy()
  })

  it("exige un motif : erreur sous la liste, aucun envoi", () => {
    const { onSubmit } = open()
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    expect(screen.getByText("Choisissez un motif.")).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("radio", { name: REPORT_REASONS[0].label }))
    expect(screen.queryByText("Choisissez un motif.")).toBeNull()
  })

  it("affiche le compteur et limite le champ libre à 1000 caractères", () => {
    open()
    const area = screen.getByRole("textbox")
    expect(area.getAttribute("maxlength")).toBe("1000")
    fireEvent.change(area, { target: { value: "abcde" } })
    expect(screen.getByText(/5\s*\/\s*1\s?000/)).toBeTruthy()
  })

  it("envoie { reason, details } puis affiche la référence", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ reference: "SIG-0096" })
    const { onClose } = open(onSubmit)
    fireEvent.click(screen.getByRole("radio", { name: "Arnaque ou demande d'argent" }))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Il demande un paiement direct  " } })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    })
    expect(onSubmit).toHaveBeenCalledWith({ reason: "scam", details: "Il demande un paiement direct" })
    expect(screen.getByText("SIG-0096")).toBeTruthy()
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" }).at(-1))
    expect(onClose).toHaveBeenCalled()
  })

  it("verrouille le double clic pendant l'envoi", async () => {
    const d = deferred()
    const onSubmit = vi.fn(() => d.promise)
    open(onSubmit)
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    const send = screen.getByRole("button", { name: "Envoyer le signalement" })
    await act(async () => {
      fireEvent.click(send)
      fireEvent.click(send)
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(send.getAttribute("aria-busy")).toBe("true")
    expect(send.disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Annuler" }).disabled).toBe(true)
    await act(async () => d.resolve({ reference: "SIG-0001" }))
    expect(screen.getByText("SIG-0001")).toBeTruthy()
  })

  it("affiche l'erreur, conserve le texte et permet de réessayer", async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce({ error: "Service indisponible." }).mockResolvedValueOnce({ reference: "SIG-0002" })
    open(onSubmit)
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Détails" } })
    const send = () => screen.getByRole("button", { name: "Envoyer le signalement" })
    await act(async () => {
      fireEvent.click(send())
    })
    expect(screen.getByRole("alert").textContent).toContain("Service indisponible.")
    expect(screen.getByRole("textbox").value).toBe("Détails")
    await act(async () => {
      fireEvent.click(send())
    })
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(screen.getByText("SIG-0002")).toBeTruthy()
  })

  it("traite une exception comme une erreur", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("réseau"))
    open(onSubmit)
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    })
    expect(screen.getByRole("alert")).toBeTruthy()
  })

  it("Annuler ferme la fenêtre", () => {
    const { onClose } = open()
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe("submitReportOnce", () => {
  it("ignore un appel quand le verrou est posé", async () => {
    const guard = { current: true }
    const onSubmit = vi.fn()
    expect(await submitReportOnce(guard, onSubmit, {})).toEqual({ skipped: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("garde le verrou après un succès et le libère après une erreur", async () => {
    const guard = { current: false }
    expect(await submitReportOnce(guard, async () => ({ reference: "SIG-0003" }), {})).toEqual({ reference: "SIG-0003" })
    expect(guard.current).toBe(true)
    guard.current = false
    await submitReportOnce(guard, async () => ({ error: "x" }), {})
    expect(guard.current).toBe(false)
  })
})
