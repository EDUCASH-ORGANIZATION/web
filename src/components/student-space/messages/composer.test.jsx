import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Composer, SendOrMic } from "./composer"

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
