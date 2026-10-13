// QA indépendante RD-CLIENT-01 vague 0 : rendu statique des composants app-ui, ARIA, classes émises sans règle CSS.
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import fs from "node:fs"
import path from "node:path"
import { Modal } from "./modal"
import { Drawer } from "./drawer"
import { ConfirmDialogView } from "./confirm-dialog"
import { ToastProvider, ToastViewport } from "./toast"
import { TabsNav } from "./tabs-nav"
import { ChipFilter } from "./chip-filter"
import { AmountField, CheckboxField, SelectField, TextareaField, TextField } from "./fields"
import { StarsInput } from "./stars-input"

const noop = () => {}
const steps = [
  { title: "Annuler la mission ?", description: "Conséquences.", confirmLabel: "Continuer" },
  { title: "Confirmer l'annulation", description: "Définitif.", confirmLabel: "Annuler la mission" },
]
const states = {
  modalDefault: <Modal open onClose={noop} title="T" description="D" footer={<button>OK</button>}>c</Modal>,
  modalDanger: <Modal open onClose={noop} title="T" size="lg" tone="danger">c</Modal>,
  drawer: <Drawer open onClose={noop} title="Profil" footer={<span>f</span>}>c</Drawer>,
  confirm1: <ConfirmDialogView steps={[steps[1]]} step={0} pending={false} error={null} tone="danger" cancelLabel="Retour" onCancel={noop} onConfirm={noop} />,
  confirm2s1: <ConfirmDialogView steps={steps} step={0} pending={false} error={null} tone="danger" cancelLabel="Retour" onCancel={noop} onConfirm={noop} />,
  confirm2s2: <ConfirmDialogView steps={steps} step={1} pending={false} error={null} tone="danger" cancelLabel="Retour" onCancel={noop} onConfirm={noop} />,
  confirm2s2pending: <ConfirmDialogView steps={steps} step={1} pending error={null} tone="danger" cancelLabel="Retour" onCancel={noop} onConfirm={noop} />,
  confirm2s2err: <ConfirmDialogView steps={steps} step={1} pending={false} error="Échec." tone="danger" cancelLabel="Retour" onCancel={noop} onConfirm={noop} />,
  toast: <ToastViewport compact={false} onDismiss={noop} toasts={[{ id: 1, title: "Fait", text: "ok", variant: "success" }, { id: 2, title: "Oups", variant: "error" }, { id: 3, title: "i", variant: "info" }]} />,
  toastProvider: <ToastProvider>x</ToastProvider>,
  tabs: <TabsNav label="Missions" activeKey="open" items={[{ key: "open", label: "Ouvertes", href: "/a", count: 2 }, { key: "done", label: "Terminées", href: "/b", count: 0 }]} />,
  chipsLink: <ChipFilter label="Filtre" value="a" options={[{ value: "a", label: "A", href: "/a", count: 3 }, { value: "b", label: "B", href: "/b" }]} />,
  chipsBtn: <ChipFilter label="Filtre" value="zzz" onChange={noop} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />,
  fields: (
    <>
      <TextField label="Nom" error="Requis" help="Aide" required name="n" />
      <TextareaField label="Msg" maxLength={500} defaultValue="abc" error="Trop court" />
      <AmountField label="Montant" name="m" defaultValue={1234567} error="Min" />
      <SelectField label="Ville" options={[{ value: "c", label: "Cotonou" }]} error="Choisir" />
      <CheckboxField label="J'ai reçu" error="Cochez" />
    </>
  ),
  stars: <StarsInput value={3} onChange={noop} />,
  starsEmpty: <StarsInput value={0} onChange={noop} />,
}
const html = Object.fromEntries(Object.entries(states).map(([k, v]) => [k, renderToStaticMarkup(v)]))

function allCss() {
  const dir = path.resolve(import.meta.dirname, "../../app/design")
  const out = []
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith(".css")) out.push(fs.readFileSync(p, "utf8")) } }
  walk(dir)
  return out.join("\n")
}
const css = allCss()
const TAILWIND_OK = new Set(["sr-only"])
const classesIn = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean)

describe("QA app-ui : classes émises", () => {
  it("toute classe émise a une règle CSS (hors modificateurs d'état)", () => {
    const missing = {}
    for (const [k, h] of Object.entries(html)) {
      for (const c of new Set(classesIn(h))) {
        if (TAILWIND_OK.has(c)) continue
        const re = new RegExp("\\." + c.replace(/[-]/g, "\\-") + "(?![\\w-])")
        if (!re.test(css)) (missing[c] ||= []).push(k)
      }
    }
    console.log("CLASSES SANS REGLE:", JSON.stringify(missing))
    expect(missing).toEqual({})
  })
  it("aucune couleur en dur ni style inline ni utilitaire Tailwind", () => {
    for (const h of Object.values(html)) {
      expect(h).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![^<]*<\/)/)
      expect(h).not.toContain("style=")
      expect(h).not.toMatch(/class="[^"]*\b(bg-|text-|p-|px-|py-|flex\b|grid\b|gap-)/)
    }
  })
})

describe("QA app-ui : ARIA", () => {
  it("dialogues : aria-labelledby pointe vers un id existant", () => {
    for (const k of ["modalDefault", "modalDanger", "drawer", "confirm1", "confirm2s1", "confirm2s2", "confirm2s2err"]) {
      const id = html[k].match(/aria-labelledby="([^"]+)"/)[1]
      expect(html[k]).toContain(`id="${id}"`)
      expect(html[k]).toContain('role="dialog"')
      expect(html[k]).toContain('aria-modal="true"')
    }
    const d = html.modalDefault.match(/aria-describedby="([^"]+)"/)[1]
    expect(html.modalDefault).toContain(`id="${d}"`)
  })
  it("confirm : rouge plein seulement à la dernière étape en danger", () => {
    expect(html.confirm1).toContain("btn--danger")
    expect(html.confirm2s1).not.toContain("btn--danger")
    expect(html.confirm2s1).toContain("btn--dark")
    expect(html.confirm2s2).toContain("btn--danger")
    expect(html.confirm2s2pending).toContain('aria-busy="true"')
    expect(html.confirm2s2pending).toContain("disabled")
    expect(html.confirm2s2err).toContain('role="alert"')
    expect(html.confirm2s2err).toContain("Échec.")
  })
  it("toast : zone live polie toujours présente, bouton fermer étiqueté", () => {
    expect(html.toastProvider).toContain('aria-live="polite"')
    expect(html.toast).toContain('aria-label="Fermer la notification"')
    expect(html.toast).toContain("toast--succes")
    expect(html.toast).toContain("toast--erreur")
  })
  it("tabs : aria-current sur l'actif seulement, compteur masqué à 0", () => {
    expect(html.tabs.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html.tabs).toContain('aria-label="Missions"')
    expect(html.tabs.match(/class="count"/g)).toHaveLength(1)
  })
  it("chips : radiogroup, un seul tabIndex 0, valeur inconnue -> premier tabbable", () => {
    for (const k of ["chipsLink", "chipsBtn"]) {
      expect(html[k]).toContain('role="radiogroup"')
      expect(html[k].match(/tabindex="0"/g)).toHaveLength(1)
    }
    expect(html.chipsBtn).toMatch(/role="radio"[^>]*aria-checked="false"/)
    expect(html.chipsLink).toContain('aria-checked="true"')
  })
  it("champs : label relié, aria-describedby sur erreur, aria-invalid", () => {
    const h = html.fields
    for (const m of h.matchAll(/<label[^>]*for="([^"]+)"/g)) expect(h).toContain(`id="${m[1]}"`)
    const errs = [...h.matchAll(/class="field__error"[^>]*>|id="([^"]+)" class="field__error"/g)]
    expect(errs.length).toBeGreaterThanOrEqual(5)
    for (const m of h.matchAll(/<div id="([^"]+)" class="field__error"/g)) expect(h).toContain(m[1])
    expect(h.match(/aria-invalid="true"/g).length).toBeGreaterThanOrEqual(4)
    expect(h).toContain("1 234 567")
    expect(h).toContain("3 / 500")
  })
  it("étoiles : 5 radios étiquetés, une seule tabulation", () => {
    expect(html.stars.match(/role="radio"/g)).toHaveLength(5)
    expect(html.stars.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html.starsEmpty.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html.stars).toContain('aria-label="1 étoile sur 5"')
    expect(html.stars).toContain('aria-label="5 étoiles sur 5"')
  })
})
