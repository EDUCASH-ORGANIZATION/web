import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { HomeProofs } from "./home-proofs"

const html = renderToStaticMarkup(<HomeProofs />)

describe("HomeProofs", () => {
  it("affiche les trois opérateurs, dont Celtiis, et jamais FedaPay", () => {
    expect(html).toContain("MTN MoMo")
    expect(html).toContain("Moov Money")
    expect(html).toContain("Celtiis Cash")
    expect(html.toLowerCase()).not.toContain("fedapay")
  })

  it("garde les deux preuves vouvoyées", () => {
    expect(html).toContain("Paiement Mobile Money")
    expect(html).toContain("Votre argent est bloqué, pas dépensé.")
    expect(html).toContain("Des étudiants vérifiés à la main.")
  })

  it("ne tutoie pas et n'emploie aucun mot banni", () => {
    expect(html).not.toMatch(/(?<![\p{L}])(ton|ta|tes|tu)(?![\p{L}])/iu)
    expect(html).not.toMatch(/livraison|course|coursier|saisie/i)
  })
})
