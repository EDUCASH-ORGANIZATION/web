import { readdirSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect } from "vitest"
import { contrastRatio } from "@/lib/design/contrast"
import { LOGO_URLS } from "@/lib/email/brand"

// QA independante : rendu HTML reel des gabarits Resend migres.
const DIR = "src/lib/email/templates"
const files = readdirSync(DIR).filter((f) => f.endsWith(".jsx"))
const LEGACY = /#2F3BED|#C8F03C|#0E0F1A|#1A6B4A|#f9fafb|#374151/i

async function render(file, props = {}) {
  const mod = await import(/* @vite-ignore */ `./templates/${file}`)
  return renderToStaticMarkup(mod.default(props))
}

describe("rendu HTML des gabarits migres", () => {
  it("12 gabarits migres", () => expect(files).toHaveLength(12))

  for (const f of files) {
    describe(f, () => {
      it("logo absolu, >= 150 px, alt EduCash, ratio 4,1", async () => {
        const html = await render(f)
        const m = html.match(/<img[^>]*>/)
        expect(m).not.toBeNull()
        const img = m[0]
        expect(img).toMatch(/src="https?:\/\/[^"]+\/email\/educash-logo-(bleu|blanc)\.png"/)
        expect(img).toContain('alt="EduCash"')
        const w = +img.match(/width="(\d+)"/)[1], h = +img.match(/height="(\d+)"/)[1]
        expect(w).toBeGreaterThanOrEqual(150)
        expect(w / h).toBeGreaterThan(4.0)
        expect(w / h).toBeLessThan(4.25)
        expect(Object.values(LOGO_URLS).some((u) => img.includes(u))).toBe(true)
      })

      it("police Arial uniquement, aucune ancienne couleur, pas de DejaVu", async () => {
        const html = await render(f)
        const fams = [...html.matchAll(/font-family:([^;"]+)/g)].map((x) => x[1].trim())
        expect(fams.length).toBeGreaterThan(0)
        for (const x of fams) expect(x).toBe("Arial, sans-serif")
        expect(html).not.toMatch(LEGACY)
        expect(html).not.toMatch(/dejavu/i)
        expect(html).not.toMatch(/\u2014/)
      })

      it("aucun texte vert (#C1EE3E) et contrastes color/background >= 4,5 par element", async () => {
        const html = await render(f)
        expect(html).not.toMatch(/[^-]color:#C1EE3E/i)
        const re = /<(\w+)[^>]*style="([^"]*)"/g
        let m
        while ((m = re.exec(html))) {
          const color = m[2].match(/(?:^|;)color:(#[0-9A-Fa-f]{6})/)
          const bg = m[2].match(/background-color:(#[0-9A-Fa-f]{6})/)
          if (color && bg) expect(contrastRatio(color[1], bg[1])).toBeGreaterThanOrEqual(4.5)
        }
      })

      it("props vides / hostiles : pas d'exception, HTML echappe", async () => {
        const evil = "<script>alert(1)</script>"
        const html = await render(f, { name: evil, title: evil, message: evil, senderName: evil, clientName: evil, studentName: evil, reason: evil })
        expect(html).not.toContain("<script>alert")
        const empty = await render(f, {})
        expect(empty.length).toBeGreaterThan(200)
        expect(empty).not.toMatch(/undefined|\[object/)
      })
    })
  }
})
