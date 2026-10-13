// QA indépendante RD-CLIENT-01 : gabarits email wallet, textes identiques à origin/main (copies dans ./orig-email).
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { render } from "@react-email/components"
import { COLORS } from "@/lib/email/brand"
import NewPay from "@/lib/email/templates/payment-received-wallet"
import NewDep from "@/lib/email/templates/wallet-deposited"
import OldPay from "./orig-email/payment-received-wallet"
import OldDep from "./orig-email/wallet-deposited"

const text = (html) => html.replace(/<[^>]*>/g, "|").replace(/\|+/g, "|").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim()
const pairs = [["payment-received-wallet", NewPay, OldPay, { firstName: "Awa", amount: "25000", missionTitle: "Ménage" }], ["wallet-deposited", NewDep, OldDep, { firstName: "Awa", amount: "25000", newBalance: "50000" }]]

describe.each(pairs)("%s", (name, N, O, props) => {
  it("textes identiques à origin/main (props nominales et par défaut)", async () => {
    for (const p of [props, {}]) {
      const a = text(await render(createElement(N, p)))
      const b = text(await render(createElement(O, p)))
      expect(a).toBe(b)
    }
  })
  it("logo en image (pas de texte), alt, largeur >= 150, URL absolue", async () => {
    const html = await render(createElement(N, props))
    const img = html.match(/<img[^>]*>/)?.[0] ?? ""
    expect(img).toMatch(/src="https?:\/\//)
    expect(img).toMatch(/alt="EduCash"|alt="Educash"/i)
    expect(+(img.match(/width="(\d+)"/)?.[1])).toBeGreaterThanOrEqual(150)
    expect(img).toMatch(/\.png|\.jpg/)
  })
  it("plus aucune couleur de l'ancienne palette verte, couleurs de la charte seulement", async () => {
    // Valeur par défaut de <Hr> (border-top #eaeaea) : la couleur effective est celle de border-color (charte).
    const html = (await render(createElement(N, props))).toLowerCase().replace("border-top:1px solid #eaeaea;", "")
    for (const old of ["1a6b" + "4a", "1580" + "3d", "f0fa" + "f5", "bbf7" + "d0", "f9fa" + "fb", "3741" + "51"].map((h) => "#" + h)) expect(html).not.toContain(old)
    const allowed = new Set(Object.values(COLORS).map((c) => String(c).toLowerCase()).concat(["#ffffff", "#fff"]))
    const used = [...html.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/g)].map((m) => m[0])
    for (const c of used) expect(allowed.has(c), c).toBe(true)
  })
  it("montant et bouton conservés", async () => {
    const html = await render(createElement(N, props))
    expect(html).toContain("25")
    expect(html).toMatch(/<a[^>]+href="https?:\/\//)
  })
})
