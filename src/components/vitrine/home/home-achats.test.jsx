import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { PAYMENT_WARNING } from "../aide/aide-content"
import { HomeAchats } from "./home-achats"

const html = renderToStaticMarkup(<HomeAchats />)
const text = html.replace(/<[^>]+>/g, " ")

describe("HomeAchats", () => {
  it("porte l'ancre achats", () => {
    expect(html).toContain('<section class="section" id="achats">')
  })

  it("montre le service bloqué, les achats payés au vendeur et trois étapes", () => {
    expect(text).toMatch(/5[\s  ]000 FCFA/)
    expect(text).toContain("service de l’étudiant, bloqué")
    expect(text).toMatch(/Achats estimés à environ 18[\s  ]000 FCFA, payés au vendeur/)
    expect(html.match(/class="v-achats__step[ "]/g)).toHaveLength(3)
    expect(html).toContain("Dantokpa")
  })

  it("décrit le flux : carte de l'étudiant, paiement hors EduCash, capture du SMS, aucune avance", () => {
    const flat = text.replace(/\s+/g, " ")
    expect(flat).toContain("carte de paiement d’achats")
    expect(flat).toContain("photo du ticket")
    expect(flat).toContain("capture du SMS")
    expect(flat).toContain("Personne n’avance d’argent pour l’autre")
    expect(flat).toMatch(/hors EduCash, qui n’est ni partie, ni dépositaire, ni garant/)
  })

  it("reprend l'avertissement de paiement à l'identique", () => {
    const warning = PAYMENT_WARNING.replace(/'/g, "&#x27;")
    expect(html).toContain(`<div class="banner__body">${warning}</div>`)
  })

  it("n'emploie aucun mot banni, jamais « commission », et vouvoie", () => {
    expect(text).not.toMatch(/livraison|course|coursier|saisie|commission/i)
    expect(text).not.toMatch(/(?<![\p{L}])(ton|ta|tes|tu|toi)(?![\p{L}])/iu)
  })
})
