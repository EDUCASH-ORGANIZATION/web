import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

// Le premier useState du compositeur est le texte saisi : on le fixe pour rendre l'état « avec texte ».
const typed = { text: "", calls: 0 }
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useState: (initial) => {
      typed.calls += 1
      return typed.calls === 1 ? [typed.text, () => {}] : actual.useState(initial)
    },
  }
})

const { Composer } = await import("./composer")

const render = (text) => {
  typed.text = text
  typed.calls = 0
  return renderToStaticMarkup(<Composer onSend={vi.fn()} />)
}

beforeEach(() => {
  typed.calls = 0
})

describe("Composer étudiant : micro et envoi", () => {
  it("au repos : photo et position à gauche, micro à droite du champ, aucun bouton d'envoi", () => {
    const html = render("")
    expect(html.indexOf("Joindre une image")).toBeLessThan(html.indexOf("Partager une position"))
    expect(html.indexOf("Partager une position")).toBeLessThan(html.indexOf("Votre message"))
    expect(html.indexOf("Votre message")).toBeLessThan(html.indexOf("Enregistrer un message vocal"))
    expect(html).not.toContain('aria-label="Envoyer"')
    expect(html).toContain("i-navigation")
    expect(html).not.toContain("i-map-pin")
  })

  it("avec du texte : le bouton d'envoi remplace le micro", () => {
    const html = render("Bonjour")
    expect(html).toContain('type="submit" class="composer__send" aria-label="Envoyer"')
    expect(html).not.toContain('aria-label="Enregistrer un message vocal"')
  })

  it("des espaces seuls ne comptent pas comme du texte", () => {
    const html = render("   ")
    expect(html).toContain('aria-label="Enregistrer un message vocal"')
    expect(html).not.toContain('aria-label="Envoyer"')
  })
})
