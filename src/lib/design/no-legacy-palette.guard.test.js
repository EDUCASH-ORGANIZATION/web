import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

// Garde-fou de palette (partie Vitest de RD-BRAND-01 ST-07).
// Bloc 1 : l'ancienne palette Direction A est interdite partout dans src/ et public/.
// Bloc 2 : la famille verte historique (#1A6B4A...) reste tolérée uniquement dans
// la liste figée EXEMPT_GREEN ci-dessous (espaces connectés, gabarits wallet de
// RD-SEC-01, vitrine du lot B...). La liste ne peut que diminuer : un nouveau
// fichier vert fait échouer le test, et une entrée devenue inutile aussi.

const ROOTS = ["src", "public"]
const EXT = /\.(svg|css|js|jsx|mjs)$/
const SKIP_DIRS = new Set(["node_modules", ".next"])

// Tests de garde qui citent les motifs interdits dans leurs propres expressions.
const SELF_REFERENCING = [
  "src/app/design/brand-tokens.test.js",
  "src/components/design/sprite.test.js",
  "src/lib/design/brand-assets.test.js",
  "src/lib/design/no-legacy-palette.guard.test.js",
  "src/lib/email/email-brand.guard.test.js",
  "src/lib/email/email-render.qa.test.jsx",
]

// Famille verte historique : à retirer fichier par fichier au lot B
// (migration des espaces connectés, de la vitrine restante et des gabarits wallet).
const EXEMPT_GREEN = [
  "src/app/(admin)/admin/dashboard/page.js",
  "src/app/(admin)/admin/missions/page.js",
  "src/app/(admin)/admin/users/page.js",
  "src/app/(admin)/admin/wallets/page.js",
  "src/app/(client)/client/dashboard/page.js",
  "src/app/(client)/client/missions/[id]/page.js",
  "src/app/(client)/client/missions/page.js",
  "src/app/(client)/client/payment/[missionId]/page.js",
  "src/app/(client)/client/profile/page.js",
  "src/app/(student)/dashboard/page.js",
  "src/app/(student)/profile/edit/page.js",
  "src/app/(student)/profile/page.js",
  "src/app/(student)/profile/verify/page.js",
  "src/app/(student)/student/missions/[id]/page.js",
  "src/app/(student)/student/missions/page.js",
  "src/app/not-found.js",
  "src/app/payment/failed/page.js",
  "src/components/admin/admin-sidebar.js",
  "src/components/admin/verifications-tabs.js",
  "src/components/auth/card-upload-zone.js",
  "src/components/client/confirm-mission-modal.js",
  "src/components/client/deposit-modal.js",
  "src/components/client/mission-detail-tabs.js",
  "src/components/client/missions-tabs.js",
  "src/components/client/new-mission-form.js",
  "src/components/client/resume-publish-link.jsx",
  "src/components/client/student-card.js",
  "src/components/client/wallet-required-gate.js",
  "src/components/client/wallet-shell.js",
  "src/components/client/withdraw-modal.js",
  "src/components/messages/conversation-view.js",
  "src/components/messages/image-preview-modal.js",
  "src/components/messages/location-picker-modal.js",
  "src/components/messages/message-bubble.js",
  "src/components/messages/realtime-conversations-list.js",
  "src/components/missions/apply-sidebar.js",
  "src/components/missions/apply-sticky-button.js",
  "src/components/missions/student-apply-form.js",
  "src/components/payment/pay-button.js",
  "src/components/profile/card-upload-form.js",
  "src/components/profile/client-edit-form.js",
  "src/components/profile/profile-edit-form.js",
  "src/components/review/review-form.js",
  "src/components/shared/bottom-nav.jsx",
  "src/components/shared/client-header.js",
  "src/components/shared/mission-card.js",
  "src/components/shared/navbar.jsx",
  "src/components/shared/offline-page.js",
  "src/components/shared/sidebar.jsx",
  "src/components/shared/student-header.js",
  "src/components/shared/verified-avatar.js",
  "src/components/shared/wallet-card.js",
  "src/components/student/applications-tabs.js",
  "src/components/student/apply-modal.js",
  "src/components/student/missions-filters-sidebar.js",
  "src/components/student/promo-card.js",
  "src/components/student/sort-select.js",
  "src/components/student/wallet-shell.js",
  "src/components/student/withdraw-modal.js",
  "src/components/ui/button.jsx",
  "src/components/ui/input.jsx",
  "src/lib/email/templates/payment-received-wallet.jsx",
  "src/lib/email/templates/wallet-deposited.jsx",
]

const LEGACY_A = /#2F3BED|#C8F03C|#0E0F1A|rgba\(\s*14\s*,\s*15\s*,\s*26\b|rgba\(\s*47\s*,\s*59\s*,\s*237\b|rgba\(\s*200\s*,\s*240\s*,\s*60\b/i
const LEGACY_GREEN = /#1A6B4A|#155a3d|#104530|#f0faf5|#E8F5EE|#d9f2e8/i

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (EXT.test(name)) acc.push(p.split("\\").join("/"))
  }
  return acc
}

const FILES = ROOTS.flatMap((r) => walk(r))
const scanned = FILES.filter((f) => !SELF_REFERENCING.includes(f))

describe("garde-fou de palette", () => {
  it("scanne des fichiers src/ et public/", () => {
    expect(FILES.length).toBeGreaterThan(100)
    expect(FILES).toContain("public/logo.svg")
  })

  it("les fichiers auto-référents existent encore", () => {
    for (const f of SELF_REFERENCING) expect(FILES, f).toContain(f)
  })

  it("aucune trace de l'ancienne palette Direction A (hex et rgba)", () => {
    const hits = scanned.filter((f) => LEGACY_A.test(readFileSync(f, "utf8")))
    expect(hits).toEqual([])
  })

  it("la famille verte historique n'apparait que dans les fichiers exemptés", () => {
    const hits = scanned.filter((f) => LEGACY_GREEN.test(readFileSync(f, "utf8")))
    expect(hits.filter((f) => !EXEMPT_GREEN.includes(f))).toEqual([])
  })

  it("chaque exemption est encore utile (la liste ne peut que diminuer)", () => {
    const stale = EXEMPT_GREEN.filter(
      (f) => !FILES.includes(f) || !LEGACY_GREEN.test(readFileSync(f, "utf8")),
    )
    expect(stale).toEqual([])
  })
})
