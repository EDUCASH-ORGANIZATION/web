import { describe, it, expect, vi, afterEach } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { render } from "@react-email/components"
import { contrastRatio } from "@/lib/design/contrast"
import { COLORS, FONT_FAMILY, LOGO_WIDTH, styles, normalizeAppUrl } from "@/lib/email/brand"

// Rendu independant de l'environnement : NEXT_PUBLIC_APP_URL est vide, les modules sont
// recharges pour que APP_URL soit recalcule (il est fige a l'import de brand.js).
async function loadFresh() {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
  vi.resetModules()
  const brand = await import("@/lib/email/brand")
  const templates = {
    WelcomeStudent: (await import("@/lib/email/templates/welcome-student")).default,
    VerificationRejected: (await import("@/lib/email/templates/verification-rejected")).default,
    VerificationApproved: (await import("@/lib/email/templates/verification-approved")).default,
    PaymentReceived: (await import("@/lib/email/templates/payment-received")).default,
  }
  return { brand, ...templates }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

const TEMPLATES_DIR = "src/lib/email/templates"
const SUPABASE_DIR = "supabase/templates"

const MIGRATED = readdirSync(TEMPLATES_DIR)
  .filter((f) => f.endsWith(".jsx"))
  .map((f) => join(TEMPLATES_DIR, f))
const SUPABASE = readdirSync(SUPABASE_DIR)
  .filter((f) => f.endsWith(".html"))
  .map((f) => join(SUPABASE_DIR, f))

const read = (f) => readFileSync(f, "utf8")
const HEX = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i
const HEX_ALL = new RegExp(HEX.source, "gi")
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

  it("police d'origine des emails : Arial, sans-serif (DejaVu reservee au logo)", () => {
    expect(FONT_FAMILY).toBe("Arial, sans-serif")
  })

  it("logos en URL absolue, largeur >= 150 px", async () => {
    const { brand } = await loadFresh()
    const { LOGO_URLS } = brand
    expect(LOGO_URLS.bleu).toBe("https://www.educash.bj/email/educash-logo-bleu.png")
    expect(LOGO_URLS.blanc).toBe("https://www.educash.bj/email/educash-logo-blanc.png")
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
  it("la liste couvre les 18 gabarits migres", () => {
    expect(MIGRATED).toHaveLength(18)
  })

  it("aucune couleur en dur ni ancienne palette : tout passe par brand.js", () => {
    const hits = MIGRATED.filter((f) => HEX.test(read(f)) || LEGACY.test(read(f)))
    expect(hits).toEqual([])
  })

  it("aucun style de gabarit ne met le vert en couleur de texte", () => {
    const textGreen = Object.entries(styles).filter(([, st]) => st.color === COLORS.vert).map(([name]) => name)
    expect(textGreen).toEqual([])
    const inline = MIGRATED.filter((f) => /color:\s*COLORS\.vert\b/.test(read(f)))
    expect(inline).toEqual([])
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
    const { WelcomeStudent } = await loadFresh()
    const html = await render(createElement(WelcomeStudent, { name: "Awa" }))
    const [tag] = imgs(html)
    expect(attr(tag, "src")).toMatch(/\/email\/educash-logo-bleu\.png$/)
    expect(attr(tag, "alt")).toBe("EduCash")
    expect(Number(attr(tag, "width"))).toBeGreaterThanOrEqual(150)
    expect(html).not.toContain("DejaVu")
    expect(html).toContain("Arial")
    expect(html.toLowerCase()).toContain("background-color:#1028f0")
    expect(html.toLowerCase()).toContain("background-color:#f3f5fc")
    expect(html).not.toMatch(LEGACY)
  })

  it("verification-rejected : logo image a la place du texte Edu/Cash", async () => {
    const { VerificationRejected } = await loadFresh()
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
    const { VerificationApproved, PaymentReceived } = await loadFresh()
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

describe("hote canonique www des logos", () => {
  const APEX_ASSET = /https?:\/\/educash\.bj\/email\//i

  it("aucun gabarit Supabase ne reference https://educash.bj/email/ sans www", () => {
    for (const f of SUPABASE) expect(read(f), f).not.toMatch(APEX_ASSET)
  })

  it("brand.js et les gabarits Resend n'ecrivent aucun logo sur l'hote nu", () => {
    for (const f of ["src/lib/email/brand.js", ...MIGRATED]) {
      expect(read(f), f).not.toMatch(APEX_ASSET)
    }
  })

  it("APP_URL vaut www quand la variable est absente ou vide", async () => {
    const { brand } = await loadFresh()
    expect(brand.APP_URL).toBe("https://www.educash.bj")
    vi.unstubAllEnvs()
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined)
    vi.resetModules()
    expect((await import("@/lib/email/brand")).APP_URL).toBe("https://www.educash.bj")
  })

  it("l'URL de logo rendue est sur www", async () => {
    const { WelcomeStudent } = await loadFresh()
    const html = await render(createElement(WelcomeStudent, { name: "Awa" }))
    expect(attr(imgs(html)[0], "src")).toMatch(/^https:\/\/www\.educash\.bj\/email\//)
    expect(html).not.toMatch(APEX_ASSET)
  })
})

describe("normalizeAppUrl", () => {
  const WWW = "https://www.educash.bj"

  it.each([
    ["", WWW],
    [undefined, WWW],
    ["https://educash.bj", WWW],
    ["https://educash.bj/", WWW],
    ["https://educash.bj//", WWW],
    ["http://educash.bj", WWW],
    ["https://EDUCASH.bj", WWW],
    ["https://educash.bj:443", WWW],
    ["http://educash.bj:80", WWW],
    [" https://educash.bj", WWW],
    ["http://localhost:3000/", "http://localhost:3000"],
    ["https://preview.educash.bj", "https://preview.educash.bj"],
    ["https://educash.bj.evil.com", "https://educash.bj.evil.com"],
    ["https://www.educash.bj/", WWW],
    ["pas une url", WWW],
  ])("%j -> %s", (raw, expected) => {
    expect(normalizeAppUrl(raw)).toBe(expected)
  })
})

describe("gabarits Supabase", () => {
  it("bandeau bleu avec img du logo blanc en URL absolue, sans texte EduCash de logo", () => {
    for (const f of SUPABASE) {
      const html = read(f).replace(/<!--[\s\S]*?-->/g, "")
      const [tag] = imgs(html)
      expect(attr(tag, "src"), f).toBe("https://www.educash.bj/email/educash-logo-blanc.png")
      expect(attr(tag, "alt"), f).toBe("EduCash")
      expect(Number(attr(tag, "width")), f).toBeGreaterThanOrEqual(150)
      expect(html, f).toContain("background-color:#1028F0")
      expect(html, f).toMatch(/font-family:Arial,Helvetica,sans-serif/)
      expect(html, f).not.toContain("DejaVu")
      expect(html, f).not.toMatch(/>\s*EduCash\s*<\/span>/)
    }
  })

  it("uniquement des couleurs de la charte", () => {
    for (const f of SUPABASE) {
      const colors = (read(f).replace(/<!--[\s\S]*?-->/g, "").match(HEX_ALL) ?? []).map((c) => c.toUpperCase())
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
