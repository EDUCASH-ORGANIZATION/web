import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Modal } from "./modal"
import { Drawer } from "./drawer"
import { ConfirmDialog, ConfirmDialogView, FALLBACK_ERROR, confirmOnce, isWithinSettle, STEP_SETTLE_MS } from "./confirm-dialog"
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

describe("ConfirmDialog : rendu d'avant et message de repli surchargeable", () => {
  it("ConfirmDialogView sans nouvelle prop : égal au rendu d'avant (empreinte SHA-256, sprite normalisé)", async () => {
    const { createHash } = await import("node:crypto")
    const one = [{ title: "Titre", description: "Desc", confirmLabel: "Oui" }]
    const out = renderToStaticMarkup(
      <ConfirmDialogView steps={one} step={0} pending={false} error="Oups" tone="default" cancelLabel="Annuler" onCancel={noop} onConfirm={noop} />,
    )
    const digest = createHash("sha256").update(out.replace(/\?v=[0-9a-f]+/g, "?v=V")).digest("hex")
    expect(digest).toBe("a2f76f7c2db958cd74e7bb1b3a8efa5647124b258e638349b259bfa15a1ab2df")
  })

  it("le message de repli par défaut est celui d'avant", () => {
    expect(FALLBACK_ERROR).toBe("Une erreur est survenue. Veuillez réessayer.")
  })

  it("une exception inattendue donne le message de repli, un refus métier garde son texte", async () => {
    const boom = async () => { throw new Error("x") }
    expect(await confirmOnce({ current: false }, boom)).toEqual({ error: FALLBACK_ERROR })
    expect(await confirmOnce({ current: false }, async () => ({ error: "refus" }))).toEqual({ error: "refus" })
  })
})

describe("confirmOnce (double clic sur la dernière étape)", () => {
  it("n'appelle onConfirm qu'une fois pour deux clics rapprochés", async () => {
    let resolve
    const onConfirm = vi.fn(() => new Promise((r) => { resolve = r }))
    const guard = { current: false }
    const first = confirmOnce(guard, onConfirm)
    expect(await confirmOnce(guard, onConfirm)).toEqual({ skipped: true })
    resolve({})
    expect(await first).toEqual({ done: true })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("libère le verrou après une erreur ou une exception pour permettre un nouvel essai", async () => {
    const guard = { current: false }
    expect(await confirmOnce(guard, async () => ({ error: "refus" }))).toEqual({ error: "refus" })
    expect(guard.current).toBe(false)
    expect((await confirmOnce(guard, async () => { throw new Error("x") })).error).toMatch(/réessayer/)
    expect(guard.current).toBe(false)
    expect(await confirmOnce(guard, async () => ({}))).toEqual({ done: true })
  })
})

describe("ToastProvider", () => {
  it("rend une zone d'annonce polie, vide au départ", () => {
    const html = renderToStaticMarkup(<ToastProvider><p>Page</p></ToastProvider>)
    expect(html).toContain("<p>Page</p>")
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="assertive"')
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

describe("StarsInput : étiquetage", () => {
  it("labelledBy remplace aria-label ; describedBy est relié ; sans eux, aria-label par défaut", () => {
    const html = renderToStaticMarkup(<StarsInput value={2} labelledBy="note-titre" describedBy="note-aide" />)
    expect(html).toContain('aria-labelledby="note-titre"')
    expect(html).toContain('aria-describedby="note-aide"')
    expect(html).not.toContain('role="radiogroup" aria-label=')
    const plain = renderToStaticMarkup(<StarsInput value={2} />)
    expect(plain).toContain('aria-label="Note"')
    expect(plain).not.toContain("aria-labelledby")
  })
})

describe("Toast : annonce des erreurs", () => {
  const zones = (html) => html.split('class="ds-toasts__zone"').slice(1)

  it("les erreurs vont dans une zone assertive séparée, les autres dans la zone polie", () => {
    const toasts = [
      { id: 1, title: "Ok", variant: "success", duration: 5000 },
      { id: 2, title: "Échec", variant: "error", duration: null },
    ]
    const [polite, assertive] = zones(renderToStaticMarkup(<ToastViewport toasts={toasts} onDismiss={noop} compact={false} />))
    expect(polite).toContain('aria-live="polite"')
    expect(polite).toContain("Ok")
    expect(polite).not.toContain("Échec")
    expect(assertive).toContain('aria-live="assertive"')
    expect(assertive).toContain("Échec")
    expect(assertive).not.toContain("Ok")
  })

  it("aucun toast n'est lui-même un role alert dans la zone polie, et les deux zones existent sans toast", () => {
    const html = renderToStaticMarkup(<ToastViewport toasts={[{ id: 1, title: "Échec", variant: "error", duration: null }]} onDismiss={noop} compact />)
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(zones(renderToStaticMarkup(<ToastViewport toasts={[]} onDismiss={noop} compact />))).toHaveLength(2)
  })
})

describe("ChipFilter : étiquettes et tabulation en mode lien", () => {
  it("garde un seul arrêt de tabulation et le rôle radio sur chaque lien", () => {
    const options = [{ value: "a", label: "A", href: "/a" }, { value: "b", label: "B", href: "/b" }]
    const html = renderToStaticMarkup(<ChipFilter options={options} value="b" label="Filtre" />)
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html.match(/role="radio"/g)).toHaveLength(2)
  })
})

describe("isWithinSettle (double clic à travers les 2 étapes)", () => {
  it("ignore les clics de confirmation juste après le passage à l'étape 2, pas avant ni après le délai", () => {
    expect(STEP_SETTLE_MS).toBe(300)
    expect(isWithinSettle(1000, null)).toBe(false)
    expect(isWithinSettle(1100, 1000)).toBe(true)
    expect(isWithinSettle(1299, 1000)).toBe(true)
    expect(isWithinSettle(1300, 1000)).toBe(false)
    expect(isWithinSettle(5000, 1000)).toBe(false)
  })
})
