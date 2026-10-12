import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { render } from "@react-email/components"
import { contrastRatio } from "@/lib/design/contrast"
import { COLORS, FONT_FAMILY, LOGO_URLS, LOGO_WIDTH } from "@/lib/email/brand"
import WelcomeStudent from "@/lib/email/templates/welcome-student"
import VerificationRejected from "@/lib/email/templates/verification-rejected"
import VerificationApproved from "@/lib/email/templates/verification-approved"
import PaymentReceived from "@/lib/email/templates/payment-received"

const TEMPLATES_DIR = "src/lib/email/templates"
const SUPABASE_DIR = "supabase/templates"

// Gabarits propres a RD-SEC-01, migres au lot B (ST-11) : retirer cette liste alors.
const EXEMPT = ["payment-received-wallet.jsx", "wallet-deposited.jsx"]

const MIGRATED = readdirSync(TEMPLATES_DIR)
  .filter((f) => f.endsWith(".jsx") && !EXEMPT.includes(f))
  .map((f) => join(TEMPLATES_DIR, f))
const SUPABASE = readdirSync(SUPABASE_DIR)
  .filter((f) => f.endsWith(".html"))
  .map((f) => join(SUPABASE_DIR, f))

const read = (f) => readFileSync(f, "utf8")
const HEX = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi
const LEGACY = /#1A6B4A|#F59E0B|#2F3BED|#0E0F1A|#F4F5FA|#F4F6FB|#15803d|#f0faf5|#fffbeb/i
const BRAND_HEX = new Set(Object.values(COLORS).map((c) => c.toUpperCase()))

const IMG_TAG = /<img\b[^>]*>/gi
const imgs = (html) => html.match(IMG_TAG) ?? []
const attr = (tag, name) => new RegExp(`${name}="([^"]*)"`, "i").exec(tag)?.[1]

describe("brand.js", () => {
  it("expose les couleurs de la charte", () => {
    expect(COLORS.bleu).toBe("#1028F0")
    expect(COLORS.vert).toBe("#C1EE3E")
    expect(COLORS.encre).toBe("#17213A")
    expect(COLORS.brume).toBe("#F3F5FC")
  })

  it("police DejaVu Sans avec repli Verdana, Arial, sans-serif", () => {
    expect(FONT_FAMILY).toBe("'DejaVu Sans', Verdana, Arial, sans-serif")
  })

  it("logos en URL absolue, largeur >= 150 px", () => {
    expect(LOGO_URLS.bleu).toMatch(/^https?:\/\/.+\/email\/educash-logo-bleu\.png$/)
    expect(LOGO_URLS.blanc).toMatch(/^https?:\/\/.+\/email\/educash-logo-blanc\.png$/)
    expect(LOGO_WIDTH).toBeGreaterThanOrEqual(150)
  })

  it("contrastes : bouton blanc sur bleu >= 8, texte secondaire >= 4,5 sur blanc et brume", () => {
    expect(contrastRatio(COLORS.blanc, COLORS.bleu)).toBeGreaterThanOrEqual(8)
    expect(contrastRatio(COLORS.ardoise, COLORS.blanc)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.ardoise, COLORS.brume)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.encre, COLORS.vert)).toBeGreaterThanOrEqual(4.5)
    for (const bg of [COLORS.menthe, COLORS.rose, COLORS.peche, COLORS.lavande]) {
      expect(contrastRatio(COLORS.encre, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("le vert n'est jamais une couleur de texte sur fond clair", () => {
    expect(contrastRatio(COLORS.vert, COLORS.blanc)).toBeLessThan(3)
  })
})

describe("gabarits Resend migres", () => {
  it("la liste couvre les 10 gabarits migres", () => {
    expect(MIGRATED).toHaveLength(10)
  })

  it("aucune couleur en dur ni ancienne palette : tout passe par brand.js", () => {
    const hits = MIGRATED.filter((f) => HEX.test(read(f)) || LEGACY.test(read(f)))
    expect(hits).toEqual([])
  })

  it("aucun logo retape en texte et logo importe de brand.js", () => {
    for (const f of MIGRATED) {
      const src = read(f)
      expect(src, f).not.toMatch(/>\s*Edu\s*<\/span>/)
      expect(src, f).toContain("logoProps")
    }
  })

  it("aucune police en dur dans les gabarits", () => {
    expect(MIGRATED.filter((f) => /fontFamily/.test(read(f)))).toEqual([])
  })

  it("welcome-student : img du logo bleu, police et couleurs de la charte", async () => {
    const html = await render(createElement(WelcomeStudent, { name: "Awa" }))
    const [tag] = imgs(html)
    expect(attr(tag, "src")).toMatch(/\/email\/educash-logo-bleu\.png$/)
    expect(attr(tag, "alt")).toBe("EduCash")
    expect(Number(attr(tag, "width"))).toBeGreaterThanOrEqual(150)
    expect(html).toContain("DejaVu Sans")
    expect(html).toContain("Arial")
    expect(html.toLowerCase()).toContain("background-color:#1028f0")
    expect(html.toLowerCase()).toContain("background-color:#f3f5fc")
    expect(html).not.toMatch(LEGACY)
  })

  it("verification-rejected : logo image a la place du texte Edu/Cash", async () => {
    const html = await render(
      createElement(VerificationRejected, { name: "Awa Sow", rejectionReason: "Photo floue" }),
    )
    expect(imgs(html)).toHaveLength(1)
    expect(attr(imgs(html)[0], "src")).toMatch(/\/email\/educash-logo-bleu\.png$/)
    expect(attr(imgs(html)[0], "alt")).toBe("EduCash")
    expect(html).not.toMatch(/>Edu<|>Cash</)
    expect(html).not.toMatch(LEGACY)
  })

  it("verification-approved et payment-received : logo present, aucune ancienne couleur", async () => {
    for (const el of [
      createElement(VerificationApproved, { name: "Awa Sow" }),
      createElement(PaymentReceived, { studentName: "Awa", amount: "5000", paidAt: "2026-10-12" }),
    ]) {
      const html = await render(el)
      expect(attr(imgs(html)[0], "src")).toMatch(/\/email\/educash-logo-bleu\.png$/)
      expect(html).not.toMatch(LEGACY)
    }
  })
})

describe("gabarits Supabase", () => {
  it("bandeau bleu avec img du logo blanc en URL absolue, sans texte EduCash de logo", () => {
    for (const f of SUPABASE) {
      const html = read(f).replace(/<!--[\s\S]*?-->/g, "")
      const [tag] = imgs(html)
      expect(attr(tag, "src"), f).toBe("https://educash.bj/email/educash-logo-blanc.png")
      expect(attr(tag, "alt"), f).toBe("EduCash")
      expect(Number(attr(tag, "width")), f).toBeGreaterThanOrEqual(150)
      expect(html, f).toContain("background-color:#1028F0")
      expect(html, f).toMatch(/font-family:'DejaVu Sans',Verdana,Arial,sans-serif/)
      expect(html, f).not.toMatch(/>\s*EduCash\s*<\/span>/)
    }
  })

  it("uniquement des couleurs de la charte", () => {
    for (const f of SUPABASE) {
      const colors = (read(f).replace(/<!--[\s\S]*?-->/g, "").match(HEX) ?? []).map((c) => c.toUpperCase())
      expect(colors.filter((c) => !BRAND_HEX.has(c)), f).toEqual([])
      expect(read(f), f).not.toMatch(LEGACY)
    }
  })

  it("contrastes du gabarit : bouton, lien et texte secondaire", () => {
    expect(contrastRatio("#FFFFFF", "#1028F0")).toBeGreaterThanOrEqual(8)
    expect(contrastRatio("#1028F0", "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio("#3A3E52", "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
  })
})
