import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { DossierReview, daysSinceExpiry, expiredTitle } = await import("./dossier-review")
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
    // Rendue deux fois : au bureau (sous la carte) et sur mobile (après la liste kv).
    expect(html.match(/<li><b>\d<\/b>/g)).toHaveLength(8)
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
    expect(html).toContain("À lire sur la carte (zone 3)")
    expect(html).toContain("À lire sur la carte (zone 1)")
    expect(html).not.toContain("Non renseigné")
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

  it("Refusés : bannière du motif, ni champ nom, ni tableau, ni Contrôle", () => {
    const html = render({ dossier: dossier({ tab: "refuses", rejectionReason: "Photo floue ou illisible" }) })
    expect(html).toContain("banner banner--erreur")
    expect(html).toContain("Motif : Photo floue ou illisible")
    expect(html).not.toContain("<table")
    expect(html).not.toContain("Nom lu sur la carte")
    expect(html).not.toContain('type="checkbox"')
  })

  it("Vérifiés : échéance en kv et bannière de révocation, sans tableau", () => {
    const html = render({ dossier: dossier({ tab: "verifies", verifiedUntil: "2027-10-01" }) })
    expect(html).toContain("Badge valable jusqu&#x27;au")
    expect(html).toContain("1 octobre 2027")
    expect(html).toContain("banner banner--info")
    expect(html).toContain("La révocation retire le badge tout de suite.")
    expect(html).not.toContain("<table")
  })

  it("Expirés : bannière avec la durée depuis l'échéance", () => {
    const html = render({ dossier: dossier({ tab: "expires", verifiedUntil: "2026-10-03" }) })
    expect(html).toContain("banner banner--alerte-doux")
    expect(html).toContain("Badge expiré depuis 12 jours")
    expect(html).not.toContain("<table")
  })

  it("Incomplets : carte manquante et bannière, sans visionneuse", () => {
    const html = render({ dossier: dossier({ tab: "incomplets", cardView: null }) })
    expect(html).toContain("ad-idcard--missing")
    expect(html).toContain("Aucune carte fournie")
    expect(html).toContain("Validation impossible sans carte")
    expect(html).not.toContain("ad-viewer")
  })

  it("À examiner : liste kv mobile, un seul champ de saisie du nom, aucun bandeau sans saisie", () => {
    const html = render({ dossier: dossier({ tab: "a-examiner", submittedOn: "2026-10-14" }) })
    expect(html).toContain("ds-mob-only")
    expect(html).toContain('<dl class="kv a2-02-mkv">')
    expect(html.match(/Nom lu sur la carte<span/g)).toHaveLength(1)
    expect(html).not.toContain("Noms concordants")
  })

  it("daysSinceExpiry et expiredTitle : 0, 1, N, date illisible", () => {
    expect(daysSinceExpiry("2026-10-15", "2026-10-15")).toBe(0)
    expect(daysSinceExpiry("2026-10-14", "2026-10-15")).toBe(1)
    expect(daysSinceExpiry("2026-09-15", "2026-10-15")).toBe(30)
    expect(daysSinceExpiry("2026-10-20", "2026-10-15")).toBe(0)
    expect(daysSinceExpiry("n'importe quoi", "2026-10-15")).toBeNull()
    expect(daysSinceExpiry(null, "2026-10-15")).toBeNull()
    expect(expiredTitle(0)).toBe("Badge expiré aujourd'hui")
    expect(expiredTitle(1)).toBe("Badge expiré depuis 1 jour")
    expect(expiredTitle(30)).toBe("Badge expiré depuis 30 jours")
    expect(expiredTitle(null)).toBe("Badge expiré")
  })

  it("vouvoiement : aucun tutoiement", () => {
    const html = render()
    expect(html).not.toMatch(/\b(tu|ta|ton|tes|vérifie|zoome|recopie)\b/i)
  })

  it("visionneuse : l'URL signée n'est que la source de l'image, jamais un lien (planche v1 : « Plein écran »)", () => {
    const html = renderToStaticMarkup(<CardViewer cardView={{ kind: "image", url: SIGNED }} name="Codjo" />)
    expect(html).toContain(`src="${SIGNED.replace(/&/g, "&amp;")}"`)
    expect(html).not.toMatch(/<a [^>]*href="https:\/\/storage\.example/s)
    expect(html).not.toContain("Ouvrir la carte dans un nouvel onglet")
    expect(html).toContain('data-zoom="100"')
  })

  it("nom lu sur la carte : champ sans attribut name (rien à soumettre ni à mémoriser)", () => {
    const html = render()
    expect(html).toMatch(/autoComplete="off"/i)
    expect(html).not.toContain('name="card-name-check"')
  })
})
