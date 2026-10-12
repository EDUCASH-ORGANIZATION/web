import { describe, expect, it } from "vitest"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"

const dir = resolve(__dirname)
const layout = readFileSync(resolve(dir, "../layout.js"), "utf8")
const kitLicense = "/Users/brandonmedehou/Desktop/EDUCASH/design-rebrand/logo-final/_src/fonts/LICENSE_DEJAVU"

const files = ["DejaVuSans-Regular.woff2", "DejaVuSans-Bold.woff2"]

describe("DejaVu Sans woff2 files", () => {
  it.each(files)("%s has the wOF2 signature and is under 120 KB", (file) => {
    const buf = readFileSync(resolve(dir, file))
    expect(buf.subarray(0, 4).toString("latin1")).toBe("wOF2")
    expect(statSync(resolve(dir, file)).size).toBeLessThan(120 * 1024)
  })

  it("ships the full DejaVu license", () => {
    const license = readFileSync(resolve(dir, "LICENSE-DejaVu.txt"), "utf8")
    expect(license).toContain("Bitstream Vera")
    try {
      expect(license).toBe(readFileSync(kitLicense, "utf8"))
    } catch (e) {
      if (e.code !== "ENOENT") throw e
    }
  })
})

describe("layout.js fonts", () => {
  it("no longer uses Google fonts or the old families", () => {
    expect(layout).not.toMatch(/next\/font\/google/)
    expect(layout).not.toMatch(/Anton|Figtree|Inter\b|--font-inter|--font-anton|--font-figtree/)
  })

  it("loads DejaVu Sans locally with weights 400 and 700", () => {
    expect(layout).toContain("next/font/local")
    expect(layout).toContain('variable: "--font-dejavu"')
    expect(layout).toMatch(/DejaVuSans-Regular\.woff2", weight: "400"/)
    expect(layout).toMatch(/DejaVuSans-Bold\.woff2", weight: "700"/)
    expect(layout).toContain("dejavu.variable")
  })

  it("uses the charter blue as theme color", () => {
    expect(layout).toContain('themeColor: "#1028F0"')
  })
})
