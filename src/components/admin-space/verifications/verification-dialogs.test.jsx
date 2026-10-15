import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Modal } from "@/components/app-ui/modal"
import { ApproveDialog } from "./approve-dialog"
import { RejectDialog } from "./reject-dialog"
import { ResetDialog } from "./reset-dialog"
import { RevokeDialog } from "./revoke-dialog"

const noop = () => {}
const html = (el) => renderToStaticMarkup(el)

describe("Modal : icône facultative", () => {
  it("sans icône, aucun modal__icon ni ic-sq (rendu inchangé)", () => {
    const out = html(<Modal open onClose={noop} title="Titre" description="Sous-titre">Corps</Modal>)
    expect(out).not.toContain("modal__icon")
    expect(out).not.toContain("ic-sq")
    expect(out).toContain('<div class="modal__head"><div><h2')
  })

  it("avec icône, pastille carrée du ton demandé avant le titre", () => {
    const out = html(<Modal open onClose={noop} title="Titre" icon={{ name: "i-x", tone: "erreur" }} />)
    expect(out).toContain('class="modal__icon ic-sq ic-sq--erreur"')
    expect(out.indexOf("modal__icon")).toBeLessThan(out.indexOf("<h2"))
  })
})

describe("modales de vérification v1", () => {
  it("validation : icône menthe, récapitulatif, bouton bleu", () => {
    const out = html(<ApproveDialog open onClose={noop} onConfirm={noop} name="Codjo" badgeUntil="2027-10-15" />)
    expect(out).toContain("ic-sq--menthe")
    expect(out).toContain('class="recap"')
    expect(out).toContain("<b>Vérifié</b>")
    expect(out).toContain("15 octobre 2027")
    expect(out).toContain("btn btn--primary a2-02-cta")
    expect(out).not.toContain("btn--dark")
  })

  it("refus : icône erreur, ton danger, aperçu ad-mail sans adresse e-mail", () => {
    const out = html(<RejectDialog open onClose={noop} onConfirm={noop} name="Codjo Ahouansou" />)
    expect(out).toContain("Refuser la carte de Codjo Ahouansou ?")
    expect(out).toContain("ic-sq--erreur")
    expect(out).toContain("modal--danger")
    expect(out).toContain("ad-mail")
    expect(out).toContain("Bonjour Codjo,")
    expect(out).not.toMatch(/@/)
  })

  it("réinitialisation : icône lavande, conséquences, bouton bleu", () => {
    const out = html(<ResetDialog open onClose={noop} onConfirm={noop} name="Codjo" />)
    expect(out).toContain("ic-sq--lavande")
    expect(out).toContain('<ul class="checklist">')
    expect(out).toContain("L&#x27;étudiant peut renvoyer une carte.")
    expect(out).toContain("btn btn--primary a2-02-cta")
  })

  it("révocation : icône erreur, bouton danger", () => {
    const out = html(<RevokeDialog open onClose={noop} onConfirm={noop} name="Codjo" />)
    expect(out).toContain("Révoquer le badge de Codjo ?")
    expect(out).toContain("ic-sq--erreur")
    expect(out).toContain("btn btn--danger")
  })
})
