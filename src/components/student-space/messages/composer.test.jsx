import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Composer, SendOrMic, hasSendableText } from "./composer"

describe("hasSendableText", () => {
  it.each([["", false], ["   ", false], ["\n\t ", false], ["a", true], [" a ", true]])("%j -> %s", (text, expected) => {
    expect(hasSendableText(text)).toBe(expected)
  })
})

describe("Composer étudiant : micro et envoi", () => {
  it("au repos : photo et position à gauche, micro à droite du champ, aucun bouton d'envoi", () => {
    const html = renderToStaticMarkup(<Composer onSend={vi.fn()} />)
    expect(html.indexOf("Joindre une image")).toBeLessThan(html.indexOf("Partager une position"))
    expect(html.indexOf("Partager une position")).toBeLessThan(html.indexOf("Votre message"))
    expect(html.indexOf("Votre message")).toBeLessThan(html.indexOf("Enregistrer un message vocal"))
    expect(html).not.toContain('aria-label="Envoyer"')
    expect(html).toContain("i-navigation")
    expect(html).not.toContain("i-map-pin")
  })

  it("avec du texte : le bouton d'envoi remplace le micro", () => {
    const html = renderToStaticMarkup(<SendOrMic hasText onRecord={vi.fn()} />)
    expect(html).toContain('type="submit" class="composer__send" aria-label="Envoyer"')
    expect(html).not.toContain("Enregistrer un message vocal")
  })

  it("sans texte : le micro, aucun envoi", () => {
    const html = renderToStaticMarkup(<SendOrMic hasText={false} onRecord={vi.fn()} />)
    expect(html).toContain('aria-label="Enregistrer un message vocal"')
    expect(html).not.toContain('aria-label="Envoyer"')
  })
})

describe("Composer étudiant : bouton ticket (demande de paiement d'achats)", () => {
  it("absent sans `onRequestPurchase` : outils inchangés (image, position)", () => {
    const html = renderToStaticMarkup(<Composer onSend={vi.fn()} />)
    expect(html).not.toContain("Demander un paiement d&#x27;achats")
    expect(html).not.toContain("i-receipt")
  })

  it("présent avec `onRequestPurchase`, après la position et avant le champ, icône ticket", () => {
    const html = renderToStaticMarkup(<Composer onSend={vi.fn()} onRequestPurchase={vi.fn()} />)
    expect(html).toContain('aria-label="Demander un paiement d&#x27;achats"')
    expect(html).toContain("i-receipt")
    expect(html.indexOf("Partager une position")).toBeLessThan(html.indexOf("Demander un paiement"))
    expect(html.indexOf("Demander un paiement")).toBeLessThan(html.indexOf("Votre message"))
  })

  it("est un bouton hors envoi (type button), jamais le bouton de soumission du formulaire", () => {
    const html = renderToStaticMarkup(<Composer onSend={vi.fn()} onRequestPurchase={vi.fn()} />)
    const button = /<button[^>]*aria-label="Demander un paiement d&#x27;achats"[^>]*>/.exec(html)[0]
    expect(button).toContain('type="button"')
  })
})
