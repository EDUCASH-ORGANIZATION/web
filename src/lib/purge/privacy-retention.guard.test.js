// Garde-fou RD-PURGE-01 : les durées affichées dans la politique de confidentialité sont liées aux constantes de
// purge-rules.js. Si une constante change, ce test échoue tant que le texte n'est pas mis à jour.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  JOURNAL_RETENTION_DAYS,
  ORPHAN_GRACE_DAYS,
  PROOF_RETENTION_MONTHS,
  REPORT_RETENTION_MONTHS,
} from "@/lib/purge/purge-rules"

const source = readFileSync(join(process.cwd(), "src/app/legal/privacy/page.js"), "utf8")
const text = source.replace(/<[^>]+>/g, "").replace(/\s+/g, " ")

function section(id) {
  const start = source.indexOf(`<LegalSection {...SECTIONS.${id}}>`)
  expect(start).toBeGreaterThan(-1)
  return source
    .slice(start, source.indexOf("</LegalSection>", start))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
}

// Durée de clôture de compte (traitement admin) et conservation comptable : engagements hors purge automatique.
const ACCOUNT_CLOSURE_DAYS = 30
const ACCOUNTING_YEARS = 10

describe("confidentialité : durées liées aux règles de purge", () => {
  it("le journal de détection affiche la durée de JOURNAL_RETENTION_DAYS", () => {
    expect(section("analyse_des_messages")).toContain(
      `le journal de détection est supprimé automatiquement après ${JOURNAL_RETENTION_DAYS} jours`,
    )
  })

  it("les signalements affichent la durée de REPORT_RETENTION_MONTHS après clôture", () => {
    expect(section("analyse_des_messages")).toContain(
      `les signalements clôturés sont supprimés automatiquement ${REPORT_RETENTION_MONTHS} mois après leur clôture`,
    )
  })

  it("les fichiers inutilisés affichent le délai ORPHAN_GRACE_DAYS", () => {
    const conservation = section("conservation_des_donnees")
    const phrase = `supprimés automatiquement dès qu’ils ne sont plus utilisés, et jamais moins de ${ORPHAN_GRACE_DAYS} jours après leur envoi`
    expect(conservation.split(phrase).length - 1).toBeGreaterThanOrEqual(3)
    expect(conservation).not.toMatch(/après un délai de \d+ jours/)
  })

  it("la clôture de compte et la durée comptable sont affichées", () => {
    const conservation = section("conservation_des_donnees")
    expect(conservation).toContain("contact@educash.bj")
    expect(conservation).toContain(`dans un délai de ${ACCOUNT_CLOSURE_DAYS} jours`)
    expect(conservation).toContain(`${ACCOUNTING_YEARS} ans`)
    expect(conservation).toContain("OHADA")
  })

  it("les preuves d'achats affichent PROOF_RETENTION_MONTHS, jamais tant qu'un signalement est ouvert", () => {
    expect(PROOF_RETENTION_MONTHS).not.toBeNull()
    const achats = section("demandes_d_achats")
    expect(achats).toContain(
      `supprimées automatiquement ${PROOF_RETENTION_MONTHS} mois après la fin de la mission`,
    )
    expect(achats).toContain("jamais tant qu’un signalement est ouvert")
    expect(achats).toMatch(/numéro à payer, le nom du vendeur et le montant restent attachés à la mission tant que la mission et les comptes concernés existent/)
  })

  it("aucune durée de purge n'est affichée sans correspondre à une règle", () => {
    const allowed = new Set([
      `${JOURNAL_RETENTION_DAYS} jours`,
      `${ORPHAN_GRACE_DAYS} jours`,
      `${ACCOUNT_CLOSURE_DAYS} jours`,
      `${REPORT_RETENTION_MONTHS} mois`,
      `${PROOF_RETENTION_MONTHS} mois`,
      `${ACCOUNTING_YEARS} ans`,
    ])
    const found = text.match(/\d+(?:&nbsp;|\s)(?:jours?|mois|ans?)/gi) ?? []
    expect(found.length).toBeGreaterThan(0)
    for (const duration of found) expect(allowed.has(duration)).toBe(true)
  })

  it("ne promet pas une suppression complète des transactions ni une durée pour les médias de messagerie", () => {
    const conservation = section("conservation_des_donnees")
    expect(conservation).toMatch(/ne les efface pas/)
    expect(conservation).not.toMatch(/supprimées dans un délai de 30 jours/)
    expect(conservation).toMatch(/aucune durée de conservation n’est fixée/)
  })
})
