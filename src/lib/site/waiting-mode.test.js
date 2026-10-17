import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  waitingModeEnabled,
  waitingHeaders,
  waitingPageHtml,
  killSwitchServiceWorker,
  isWaitingPassthrough,
  ROBOTS_WAITING_TEXT,
  WAITING_RETRY_AFTER_SECONDS,
} from "./waiting-mode.js"

describe("waitingModeEnabled", () => {
  it.each([undefined, "", "false", "TRUE", "True", "1", "true\n", " true", "true ", "yes"])(
    "faux pour %j",
    (value) => {
      expect(waitingModeEnabled({ SITE_WAITING_MODE: value })).toBe(false)
    },
  )
  it("vrai pour la chaîne exacte true", () => {
    expect(waitingModeEnabled({ SITE_WAITING_MODE: "true" })).toBe(true)
  })
  it("faux quand le drapeau est absent", () => {
    expect(waitingModeEnabled({})).toBe(false)
  })
})

describe("waitingHeaders", () => {
  it("expose les en-têtes exacts", () => {
    expect(waitingHeaders()).toEqual({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Retry-After": "86400",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Clear-Site-Data": '"storage"',
      "Referrer-Policy": "no-referrer",
    })
    expect(WAITING_RETRY_AFTER_SECONDS).toBe(86400)
  })
})

describe("waitingPageHtml", () => {
  const html = waitingPageHtml()
  it("est un document français noindex avec le logo", () => {
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('<meta name="robots" content="noindex, nofollow, noarchive">')
    expect(html).toContain('<meta name="viewport"')
    expect(html).toContain("<title>EduCash</title>")
    expect(html).toContain('href="/attente.css"')
    expect(html).toContain('src="/logo-horizontal-blanc.svg"')
    expect(html).toContain('width="180" height="44"')
    expect(html).toContain("mailto:contact@educash.bj")
  })
  it("ne contient ni script, ni manifest, ni style en ligne, ni tiret cadratin", () => {
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/manifest/i)
    expect(html).not.toMatch(/style=/i)
    expect(html).not.toMatch(/<style/i)
    expect(html).not.toContain(String.fromCharCode(0x2014))
    expect(html).not.toContain(String.fromCharCode(0x2013))
    expect(html).not.toMatch(/https?:\/\//)
  })
  it("vouvoie", () => {
    expect(html).not.toMatch(/\b(tu|ton|ta|tes|toi|reviens)\b/i)
    expect(html).toContain("votre patience")
  })
})

describe("killSwitchServiceWorker", () => {
  const source = killSwitchServiceWorker()
  it("nettoie caches, désinscrit et recharge les fenêtres", () => {
    expect(source).toContain("skipWaiting")
    expect(source).toContain("caches.keys()")
    expect(source).toContain("caches.delete")
    expect(source).toContain("unregister")
    expect(source).toContain('matchAll({ type: "window" })')
    expect(source).toContain("client.navigate(client.url)")
  })
  it("est un JavaScript syntaxiquement valide", () => {
    expect(() => new Function(source)).not.toThrow()
  })
})

describe("isWaitingPassthrough", () => {
  it("accepte uniquement /attente.css et /api/health", () => {
    expect(isWaitingPassthrough("/attente.css")).toBe(true)
    expect(isWaitingPassthrough("/api/health")).toBe(true)
  })
  it.each(["/", "/api/health/", "/api/healthz", "/api/health/x", "//api/health", "/API/health", "/api/email", "/attente.css/x"])(
    "refuse %s",
    (p) => {
      expect(isWaitingPassthrough(p)).toBe(false)
    },
  )
})

describe("isWaitingPassthrough /api/cron/purge", () => {
  it("laisse passer exactement /api/cron/purge", () => {
    expect(isWaitingPassthrough("/api/cron/purge")).toBe(true)
  })
  it.each([
    "/api/cron",
    "/api/cron/",
    "/api/cron/purge/",
    "/api/cron/purge/x",
    "/api/cron/purge.rsc",
    "/api/cron/purge.json",
    "/api/cron/Purge",
    "/API/cron/purge",
    "/api/CRON/purge",
    "//api/cron/purge",
    "/api//cron/purge",
    "/api/cron/purge;x=1",
    "/api/cron/purge?x=1",
    "/api/cron/purge#x",
    "/api/cron/%70urge",
    "/api/%63ron/purge",
    "/api%2Fcron%2Fpurge",
    "/api/cron/purge%2F",
    "/api/cron/purge%00",
    "/api/cron/purge ",
    "/api/cron/../cron/purge",
    "/api/cron/./purge",
    "/api/email",
    "/api/cron/other",
  ])("refuse la variante %s", (p) => {
    expect(isWaitingPassthrough(p)).toBe(false)
  })
})

describe("ROBOTS_WAITING_TEXT", () => {
  it("interdit tout et n'annonce pas de sitemap", () => {
    expect(ROBOTS_WAITING_TEXT).toBe("User-agent: *\nDisallow: /\n")
  })
})

describe("module pur", () => {
  it("n'a ni directive client ni import", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/site/waiting-mode.js"), "utf8")
    expect(src).not.toMatch(/^\s*["']use client["']/m)
    expect(src).not.toMatch(/^\s*import\s/m)
  })
})
