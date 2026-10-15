import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { DossierReview } = await import("./dossier-review")
const { CardViewer } = await import("./card-viewer")

const SIGNED = "https://storage.example/sign/cards/u1.jpg?token=SECRET"
const dossier = (over = {}) => ({
  userId: "11111111-1111-4111-8111-111111111111",
  name: "Codjo Ahouansou",
  school: "EPAC",
  level: "Licence 3",
  verifiedUntil: null,
  rejectionReason: null,
  cardView: { kind: "image", url: SIGNED },
  ...over,
})
const render = (props) => renderToStaticMarkup(<DossierReview dossier={dossier()} today="2026-10-15" showChecklist {...props} />)

describe("DossierReview", () => {
  it("légende numérotée 1 à 4 avec l'année calculée", () => {
    const html = render()
    expect(html.match(/<li><b>\d<\/b>/g)).toHaveLength(4)
    expect(html).toContain("Année universitaire : 2025-2026 ou 2026-2027.")
  })

  it("tableau Champ / Déclaré au profil / Saisi avec la carte avec data-label, sans valeur inventée", () => {
    const html = render()
    expect(html).toContain("Saisi avec la carte")
    expect(html).toContain("Déclaré au profil")
    expect(html.match(/data-label="Champ"/g)).toHaveLength(4)
    expect(html).toContain("<b>EPAC</b>")
    expect(html).toContain("<b>Licence 3</b>")
    expect(html).toContain("2026-2027")
    expect(html).toContain("(année en cours)")
    expect(html.match(/Non renseigné/g)).toHaveLength(3)
  })

  it("aucun encart des noms sans saisie", () => {
    const html = render()
    expect(html).not.toContain("Noms concordants")
    expect(html).not.toContain("Noms différents")
    expect(html).toContain('aria-live="polite"')
  })

  it("Contrôle présent seulement si showChecklist", () => {
    expect(render().match(/type="checkbox"/g)).toHaveLength(3)
    expect(render()).toContain("Contrôle")
    const none = render({ showChecklist: false })
    expect(none).not.toContain('type="checkbox"')
    expect(none).not.toContain("Contrôle")
  })

  it("le nom saisi n'est jamais dans un formulaire d'envoi : champ sans formulaire, aucune action", () => {
    const html = render()
    expect(html).not.toContain("<form")
    expect(html).toContain('autoComplete="off"')
  })

  it("motif de refus et échéance du badge conservés", () => {
    const html = render({ dossier: dossier({ rejectionReason: "Photo floue ou illisible", verifiedUntil: "2027-10-01" }) })
    expect(html).toContain("Photo floue ou illisible")
    expect(html).toContain("1 octobre 2027")
  })

  it("vouvoiement : aucun tutoiement", () => {
    const html = render()
    expect(html).not.toMatch(/\b(tu|ta|ton|tes|vérifie|zoome|recopie)\b/i)
  })

  it("visionneuse : lien d'ouverture sécurisé, même URL signée", () => {
    const html = renderToStaticMarkup(<CardViewer cardView={{ kind: "image", url: SIGNED }} name="Codjo" />)
    expect(html).toMatch(/<a [^>]*href="https:\/\/storage\.example[^"]*"[^>]*aria-label="Ouvrir la carte dans un nouvel onglet"/s)
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('data-zoom="100"')
  })
})
