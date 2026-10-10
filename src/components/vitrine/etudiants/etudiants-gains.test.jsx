import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { COMMISSION_RATE, netAmount } from "@/lib/constants/missions"
import { EtudiantsGains } from "./etudiants-gains"

const text = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/[  ]/g, " ")

describe("EtudiantsGains", () => {
  const html = renderToStaticMarkup(<EtudiantsGains />)
  const commission = Math.round(COMMISSION_RATE * 100)
  const share = 100 - commission

  it("calcule les pourcentages depuis COMMISSION_RATE", () => {
    expect(text(html)).toContain(`${share} % pour toi`)
    expect(text(html)).toContain(`commission unique de ${commission} %`)
  })

  it("la barre porte le net et la commission du budget exemple", () => {
    const net = netAmount(25000)
    const t = text(html)
    expect(t).toContain(`${new Intl.NumberFormat("fr-FR").format(net).replace(/[  ]/g, " ")} FCFA`)
    expect(html).toContain('class="v05-bar__etu"')
    expect(html).toContain('class="v05-bar__edu"')
  })

  it("chaque exemple de budget affiche le net via netAmount", () => {
    const t = text(html)
    for (const budget of [5000, 25000, 15000]) {
      const net = new Intl.NumberFormat("fr-FR").format(netAmount(budget)).replace(/[  ]/g, " ")
      expect(t).toContain(`Tu touches ${net} FCFA`)
    }
  })

  it("aucun pourcentage de commission écrit en dur dans le code des composants", () => {
    const dir = import.meta.dirname
    const files = fs.readdirSync(dir).filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\./.test(f))
    const hits = files.filter((f) => /\b(12|88)\s*(%|&nbsp;%)/.test(fs.readFileSync(path.join(dir, f), "utf8")))
    expect(hits).toEqual([])
  })
})
