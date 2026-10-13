import { describe, it, expect } from "vitest"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

// QA RD-SEC-01 : vérifications structurelles des critères d'acceptation.
const ROOT = process.cwd()
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8")

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}
const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/")
const sources = () =>
  walk(path.join(ROOT, "src")).map(rel).filter((f) => /\.(js|jsx|ts|tsx)$/.test(f) && !/\.test\./.test(f))

describe("RD-SEC-01 critères d'acceptation", () => {
  it("les pages admin exigent requireRole(['admin'])", () => {
    const pages = ["dashboard", "missions", "users", "verifications", "wallets"]
    for (const p of pages) {
      const src = read(`src/app/(admin)/admin/${p}/page.js`)
      expect(src, p).toMatch(/requireRole\(\s*\["admin"\]\s*\)/)
    }
  })

  it("aucune route de paiement direct de mission ne subsiste", () => {
    const dirs = ["src/app/(client)/client/payment", "src/app/(client)/client/payment/success", "src/app/(client)/client/payment/failed"]
    for (const d of dirs) expect(existsSync(path.join(ROOT, d)), d).toBe(false)
    const files = walk(path.join(ROOT, "src/app")).map(rel)
    expect(files.filter((f) => /payment\/(\[missionId\]|success|failed)/.test(f))).toEqual([])
  })

  it("aucun fichier ne lit user_metadata.role ni app_metadata.role (autorité : profiles.role)", () => {
    const hits = sources().filter((f) => /(user|app)_metadata\??\.role/.test(readFileSync(path.join(ROOT, f), "utf8")))
    expect(hits).toEqual([])
    expect(read("src/lib/auth/server-role.js")).not.toMatch(/FALLBACK_ROLES/)
  })

  it("createServiceClient n'est importé dans aucun composant client", () => {
    const hits = sources().filter((f) => {
      const s = readFileSync(path.join(ROOT, f), "utf8")
      return /^\s*["']use client["']/m.test(s) && /createServiceClient|supabase\/service/.test(s)
    })
    expect(hits).toEqual([])
  })

  it("aucun tiret cadratin (U+2014) ni demi-cadratin (U+2013) dans src (tous types de fichiers)", () => {
    const bad = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    const hits = walk(path.join(ROOT, "src")).map(rel).filter((f) => bad.test(readFileSync(path.join(ROOT, f), "utf8")))
    expect(hits).toEqual([])
  })

  it("la limite d'envoi de la carte étudiante est de 10 Mo", () => {
    expect(read("src/components/auth/student-onboarding/step-card.jsx")).toMatch(/MAX_UPLOAD_BYTES = 10 \* 1024 \* 1024/)
    expect(read("src/components/auth/card-upload-zone.js")).toMatch(/MAX_SIZE_BYTES = 10 \* 1024 \* 1024/)
  })

  it("les Edge Functions de paiement et auto-release utilisent le garde 503", () => {
    for (const f of ["create-deposit-transaction", "process-withdrawal"]) {
      expect(read(`supabase/functions/${f}/index.ts`), f).toMatch(/paymentsGuard/)
    }
    const auto = read("supabase/functions/auto-release/index.ts")
    expect(auto).toMatch(/status:\s*503/)
    expect(auto).not.toMatch(/wallet_release|\.rpc\(/)
  })
})
