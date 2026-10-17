// Garde-fou RD-CLOSE-01 : la politique de confidentialité et la FAQ décrivent le cycle de clôture réel
// (délai de grâce lié à closure-rules.js, données effacées, données gardées).
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CLOSED_ACCOUNT_LABEL, CLOSURE_GRACE_DAYS } from "@/lib/account-closure/closure-rules"
import { AIDE_THEMES } from "@/components/vitrine/aide/aide-content"

const source = readFileSync(join(process.cwd(), "src/app/legal/privacy/page.js"), "utf8")

function section(id) {
  const start = source.indexOf(`<LegalSection {...SECTIONS.${id}}>`)
  expect(start).toBeGreaterThan(-1)
  return source
    .slice(start, source.indexOf("</LegalSection>", start))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
}

const faqItem = AIDE_THEMES.flatMap((c) => c.items).find((i) => i.id === "compte-supprimer")
const faq = faqItem ? faqItem.answer.join(" ") : ""

describe("confidentialité : clôture de compte", () => {
  const conservation = section("conservation_des_donnees")

  it("la section 6 affiche le délai de grâce et la réactivation", () => {
    expect(conservation).toContain(`${CLOSURE_GRACE_DAYS} jours`)
    expect(conservation).toContain("réactivé")
  })

  it("la section 6 cite chaque donnée effacée", () => {
    for (const donnee of [
      "adresse e-mail",
      "le nom",
      "photo de profil",
      "présentation",
      "numéro de téléphone",
      "identifiant de notification",
      "carte étudiante",
      "notifications reçues",
      "candidatures non retenues",
    ]) {
      expect(conservation).toContain(donnee)
    }
  })

  it("la section 6 cite les données gardées, le report et le compte sans nom", () => {
    expect(conservation).toContain("sans nom")
    expect(conservation).toContain(`« ${CLOSED_ACCOUNT_LABEL} »`)
    expect(conservation).toMatch(/signalement ou un litige est en cours/)
    expect(conservation).toMatch(/reporté/)
    expect(conservation).toContain("journal des fermetures")
  })

  it("la section 7 précise le rattachement à un compte sans nom", () => {
    expect(section("demandes_d_achats")).toContain("restent rattachées à un compte sans nom")
  })
})

describe("FAQ : fermer mon compte", () => {
  it("cite les conditions, le délai et la réactivation", () => {
    expect(faqItem.question).toBe("Comment fermer mon compte ?")
    expect(faq).toContain("Aucune mission")
    expect(faq).toContain("aucun solde")
    expect(faq).toContain("aucun signalement")
    expect(faq).toContain(`${CLOSURE_GRACE_DAYS} jours`)
    expect(faq).toContain("réactiver")
    expect(faq).toContain("sans nom")
  })
})
