import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Modal } from "./modal"
import { Drawer } from "./drawer"
import { ConfirmDialog, ConfirmDialogView } from "./confirm-dialog"
import { ToastProvider, ToastViewport } from "./toast"
import { TabsNav } from "./tabs-nav"
import { ChipFilter } from "./chip-filter"
import { AmountField, CheckboxField, SelectField, TextareaField, TextField } from "./fields"
import { StarsInput } from "./stars-input"

const noop = () => {}

describe("Modal", () => {
  it("ne rend rien fermée", () => {
    expect(renderToStaticMarkup(<Modal open={false} onClose={noop} title="Titre" />)).toBe("")
  })

  it("expose le rôle dialog, le titre relié et le bouton Fermer étiqueté", () => {
    const html = renderToStaticMarkup(
      <Modal open onClose={noop} title="Annuler la mission" description="Cette action est définitive." footer={<button>Valider</button>}>
        Contenu
      </Modal>,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    const labelledby = html.match(/aria-labelledby="([^"]+)"/)[1]
    expect(html).toContain(`id="${labelledby}"`)
    expect(html).toContain("Annuler la mission")
    expect(html).toContain("aria-describedby=")
    expect(html).toContain('aria-label="Fermer"')
    expect(html).toContain("modal__foot")
    expect(html).toContain("scrim")
    expect(html).not.toContain("style=")
  })

  it("applique la taille et le ton danger en bureau", () => {
    const html = renderToStaticMarkup(<Modal open onClose={noop} title="T" size="sm" tone="danger" />)
    expect(html).toContain("modal modal--sm modal--danger")
  })
})

describe("Drawer", () => {
  it("ne rend rien fermé, rend un dialogue étiqueté ouvert", () => {
    expect(renderToStaticMarkup(<Drawer open={false} onClose={noop} title="T" />)).toBe("")
    const html = renderToStaticMarkup(<Drawer open onClose={noop} title="Filtres" footer={<span>Pied</span>}>Corps</Drawer>)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain("Filtres")
    expect(html).toContain("drawer__foot")
    expect(html).toContain('aria-label="Fermer"')
  })
})

describe("ConfirmDialog", () => {
  const steps = [
    { title: "Annuler ?", description: "Première question.", confirmLabel: "Continuer" },
    { title: "Vraiment ?", description: "Dernière question.", confirmLabel: "Oui, annuler" },
  ]
  const base = { steps, step: 0, pending: false, error: null, tone: "danger", cancelLabel: "Retour", onCancel: noop, onConfirm: noop }

  it("ne rend rien fermé", () => {
    expect(renderToStaticMarkup(<ConfirmDialog open={false} onClose={noop} onConfirm={noop} steps={steps} />)).toBe("")
  })

  it("ouvert, commence à la première étape", () => {
    const html = renderToStaticMarkup(<ConfirmDialog open onClose={noop} onConfirm={noop} steps={steps} tone="danger" />)
    expect(html).toContain("Annuler ?")
    expect(html).toContain("Continuer")
  })

  it("garde le bouton neutre avant la dernière étape et en ton par défaut", () => {
    expect(renderToStaticMarkup(<ConfirmDialogView {...base} />)).not.toContain("btn--danger")
    expect(renderToStaticMarkup(<ConfirmDialogView {...base} step={1} tone="default" />)).not.toContain("btn--danger")
  })

  it("affiche le rouge plein seulement en danger à la dernière étape", () => {
    const html = renderToStaticMarkup(<ConfirmDialogView {...base} step={1} />)
    expect(html).toContain("btn btn--danger")
    expect(html).toContain("Oui, annuler")
  })

  it("rend l'état d'envoi : boutons inactifs, aria-busy", () => {
    const html = renderToStaticMarkup(<ConfirmDialogView {...base} step={1} pending />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain("Envoi en cours")
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })

  it("affiche l'erreur dans une alerte sans fermer", () => {
    const html = renderToStaticMarkup(<ConfirmDialogView {...base} step={1} error="Solde insuffisant." />)
    expect(html).toContain('role="alert"')
    expect(html).toContain("Solde insuffisant.")
    expect(html).toContain('role="dialog"')
  })
})

describe("ToastProvider", () => {
  it("rend une zone d'annonce polie, vide au départ", () => {
    const html = renderToStaticMarkup(<ToastProvider><p>Page</p></ToastProvider>)
    expect(html).toContain("<p>Page</p>")
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('class="toast ')
  })

  it("rend les variantes succès et erreur avec bouton de fermeture", () => {
    const toasts = [
      { id: 1, title: "Enregistré", variant: "success", duration: 5000 },
      { id: 2, title: "Échec", text: "Réessayez.", variant: "error", duration: 8000 },
    ]
    const html = renderToStaticMarkup(<ToastViewport toasts={toasts} onDismiss={noop} compact={false} />)
    expect(html).toContain("toast toast--succes")
    expect(html).toContain("toast toast--erreur")
    expect(html).toContain("Réessayez.")
    expect(html.match(/aria-label="Fermer la notification"/g)).toHaveLength(2)
    expect(html).toContain("toasts--bureau")
    expect(renderToStaticMarkup(<ToastViewport toasts={[]} onDismiss={noop} compact />)).toContain("toasts--mobile")
  })
})

describe("TabsNav", () => {
  const items = [
    { key: "open", label: "Ouvertes", href: "/client/missions?onglet=open", count: 2 },
    { key: "done", label: "Terminées", href: "/client/missions?onglet=done", count: 0 },
  ]
  it("marque l'onglet courant et affiche les compteurs non nuls", () => {
    const html = renderToStaticMarkup(<TabsNav items={items} activeKey="open" label="Mes missions" />)
    expect(html).toContain('aria-label="Mes missions"')
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain("tab is-active")
    expect(html).toContain('<span class="count">2</span>')
    expect(html.match(/class="count"/g)).toHaveLength(1)
  })
})

describe("ChipFilter", () => {
  const options = [
    { value: "all", label: "Tout" },
    { value: "in", label: "Recharges", count: 3 },
    { value: "out", label: "Retraits" },
  ]
  it("rend un radiogroup avec un seul arrêt de tabulation (mode bouton)", () => {
    const html = renderToStaticMarkup(<ChipFilter options={options} value="in" onChange={noop} label="Filtrer" />)
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Filtrer"')
    expect(html.match(/role="radio"/g)).toHaveLength(3)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html).toContain("chip is-selected")
    expect(html).toContain("<button")
  })
  it("rend des liens en mode lien et tombe sur le premier sans sélection", () => {
    const linked = options.map((o) => ({ ...o, href: `/x?f=${o.value}` }))
    const html = renderToStaticMarkup(<ChipFilter options={linked} value="inconnu" label="Filtrer" />)
    expect(html).toContain('href="/x?f=all"')
    expect(html).not.toContain("<button")
    expect(html).toContain('tabindex="0"')
  })
})

describe("champs", () => {
  it("TextField : libellé relié, aide et erreur reliées par aria-describedby", () => {
    const html = renderToStaticMarkup(<TextField label="Titre" help="Soyez précis." error="Champ requis." required name="title" />)
    const inputId = html.match(/<input[^>]*\sid="([^"]+)"/)[1]
    expect(html).toContain(`for="${inputId}"`)
    const describedby = html.match(/aria-describedby="([^"]+)"/)[1].split(" ")
    expect(describedby).toHaveLength(2)
    for (const id of describedby) expect(html).toContain(`id="${id}"`)
    expect(html).toContain("field__error")
    expect(html).toContain("input is-error")
    expect(html).toContain('aria-invalid="true"')
  })

  it("TextField sans erreur : aucun is-error ni aria-invalid", () => {
    const html = renderToStaticMarkup(<TextField label="Titre" />)
    expect(html).not.toContain("is-error")
    expect(html).not.toContain("aria-invalid")
    expect(html).not.toContain("aria-describedby")
  })

  it("TextareaField : compteur n / max", () => {
    const html = renderToStaticMarkup(<TextareaField label="Message" maxLength={1000} defaultValue="Bonjour" />)
    expect(html).toContain("field__count")
    expect(html).toContain("7 / 1")
    expect(html).toContain("aria-describedby=")
  })

  it("AmountField : montant formaté, suffixe FCFA et champ caché", () => {
    const html = renderToStaticMarkup(<AmountField label="Budget" name="budget" defaultValue={12500} error="Trop bas." />)
    expect(html).toContain("12 500")
    expect(html).toContain("FCFA")
    expect(html).toContain('inputMode="numeric"')
    expect(html).toContain('name="budget"')
    expect(html).toContain('value="12500"')
    expect(html).toContain("control is-error")
    expect(html).toContain("Trop bas.")
  })

  it("SelectField : enveloppe le Select, libellé relié au déclencheur", () => {
    const html = renderToStaticMarkup(
      <SelectField label="Ville" options={[{ value: "cot", label: "Cotonou" }]} placeholder="Choisir" error="Requis." />,
    )
    const id = html.match(/<button[^>]*\sid="([^"]+)"/)[1]
    expect(html).toContain(`for="${id}"`)
    expect(html).toContain('role="combobox"')
    expect(html).toContain("select is-placeholder is-error")
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain("Requis.")
  })

  it("CheckboxField : case reliée à son libellé et à son erreur", () => {
    const html = renderToStaticMarkup(<CheckboxField label="J'accepte" help="Voir les conditions." error="À cocher." />)
    const id = html.match(/<input[^>]*\sid="([^"]+)"/)[1]
    expect(html).toContain(`for="${id}"`)
    expect(html).toContain('type="checkbox"')
    expect(html).toContain("check__sub")
    expect(html).toContain("check is-error")
    expect(html).toContain("aria-describedby=")
  })
})

describe("StarsInput", () => {
  it("rend 5 radios étiquetés, la note courante cochée et seule tabulable", () => {
    const html = renderToStaticMarkup(<StarsInput value={3} onChange={vi.fn()} label="Votre note" />)
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Votre note"')
    expect(html.match(/role="radio"/g)).toHaveLength(5)
    expect(html).toContain('aria-label="1 étoile sur 5"')
    expect(html).toContain('aria-label="5 étoiles sur 5"')
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html.match(/ic is-on/g)).toHaveLength(3)
  })
  it("sans note, la première étoile reste atteignable", () => {
    const html = renderToStaticMarkup(<StarsInput value={0} />)
    expect(html).not.toContain('aria-checked="true"')
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
  })
})
