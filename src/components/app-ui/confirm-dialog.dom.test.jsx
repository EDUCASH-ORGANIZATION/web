// @vitest-environment jsdom

// Exemple de test interactif (vrai DOM, vrais événements).
//
// Comment écrire un test interactif :
//  1. Première ligne du fichier : `// @vitest-environment jsdom`. Seuls ces fichiers passent en jsdom.
//     La suite reste en environnement node par défaut (vitest.config.mjs n'est pas modifié) et les
//     tests existants (renderToStaticMarkup, logique pure) ne changent pas.
//  2. Importer `@/qa/dom/setup.test.support` : nettoyage du DOM après chaque test, matchMedia et getClientRects
//     simulés (jsdom n'a pas de mise en page).
//  3. Moquer avec `vi.mock` tout module qui appelle le serveur (actions, `server-only`) AVANT l'import
//     dynamique du composant. Ne jamais importer de module `server-only` réel.
//  4. Utiliser `render`, `screen` et `fireEvent` de @testing-library/react ; chercher par rôle et nom
//     accessible (`getByRole("dialog")`), pas par classe CSS.
//  5. Ces fichiers ne doivent être importés par aucun code de src/ hors tests : ils sont absents du build.
import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { useState } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"

const { ConfirmDialog } = await import("./confirm-dialog")

const ONE_STEP = [{ title: "Supprimer ?", description: "Action définitive.", confirmLabel: "Supprimer" }]

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function Harness({ onConfirm, onClosed = () => {}, steps = ONE_STEP }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Ouvrir</button>
      <ConfirmDialog
        open={open}
        steps={steps}
        onConfirm={onConfirm}
        onClose={() => {
          onClosed()
          setOpen(false)
        }}
      />
    </>
  )
}

function openDialog(props) {
  render(<Harness {...props} />)
  const trigger = screen.getByRole("button", { name: "Ouvrir" })
  trigger.focus()
  fireEvent.click(trigger)
  return trigger
}

describe("ConfirmDialog (interactions réelles)", () => {
  it("expose un dialogue modal nommé par son titre et décrit", () => {
    openDialog({ onConfirm: vi.fn() })
    const dialog = screen.getByRole("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    const titleId = dialog.getAttribute("aria-labelledby")
    expect(document.getElementById(titleId).textContent).toBe("Supprimer ?")
    expect(document.getElementById(dialog.getAttribute("aria-describedby")).textContent).toBe("Action définitive.")
  })

  it("donne le focus initial au choix sûr « Annuler »", () => {
    openDialog({ onConfirm: vi.fn() })
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Annuler" }))
  })

  it("Échap ferme la boîte et rend le focus au déclencheur", () => {
    const onClosed = vi.fn()
    const trigger = openDialog({ onConfirm: vi.fn(), onClosed })
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("un clic sur le fond ferme, un clic dans la boîte ne ferme pas", () => {
    const onClosed = vi.fn()
    openDialog({ onConfirm: vi.fn(), onClosed })
    const dialog = screen.getByRole("dialog")
    fireEvent.pointerDown(dialog)
    fireEvent.click(dialog)
    expect(onClosed).not.toHaveBeenCalled()
    const scrim = dialog.parentElement
    fireEvent.pointerDown(scrim)
    fireEvent.click(scrim)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it("Tab et Maj+Tab bouclent dans la boîte", () => {
    openDialog({ onConfirm: vi.fn() })
    const close = screen.getByRole("button", { name: "Fermer" })
    const cancel = screen.getByRole("button", { name: "Annuler" })
    const confirm = screen.getByRole("button", { name: "Supprimer" })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(confirm)
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(confirm)
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(close)
  })

  it("bouton désactivé dès le premier clic : un double clic n'appelle l'action qu'une fois, puis ferme", async () => {
    const gate = deferred()
    const onConfirm = vi.fn(() => gate.promise)
    const onClosed = vi.fn()
    openDialog({ onConfirm, onClosed })
    const confirm = screen.getByRole("button", { name: "Supprimer" })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await act(async () => {
      gate.resolve({})
    })
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("le verrou synchrone bloque un second clic arrivé avant tout rendu (bouton encore actif)", async () => {
    const gate = deferred()
    const onConfirm = vi.fn(() => gate.promise)
    openDialog({ onConfirm })
    const confirm = screen.getByRole("button", { name: "Supprimer" })
    // Les deux clics partent dans le même act : React n'a pas encore appliqué `disabled`.
    act(() => {
      fireEvent.click(confirm)
      fireEvent.click(confirm)
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await act(async () => {
      gate.resolve({})
    })
  })

  it("pendant l'envoi : Échap, fond et Annuler sont sans effet, le bouton est occupé", async () => {
    const gate = deferred()
    const onClosed = vi.fn()
    openDialog({ onConfirm: () => gate.promise, onClosed })
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    const busy = await screen.findByRole("button", { name: "Envoi en cours" })
    expect(busy.getAttribute("aria-busy")).toBe("true")
    expect(busy.disabled).toBe(true)
    fireEvent.keyDown(document, { key: "Escape" })
    const scrim = screen.getByRole("dialog").parentElement
    fireEvent.pointerDown(scrim)
    fireEvent.click(scrim)
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(onClosed).not.toHaveBeenCalled()
    await act(async () => {
      gate.resolve({})
    })
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it("affiche un refus dans role=alert, reste ouvert, et permet une nouvelle tentative", async () => {
    const onConfirm = vi.fn().mockResolvedValueOnce({ error: "Solde insuffisant." }).mockResolvedValueOnce({})
    const onClosed = vi.fn()
    openDialog({ onConfirm, onClosed })
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    expect((await screen.findByRole("alert")).textContent).toContain("Solde insuffisant.")
    expect(onClosed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    await act(async () => {})
    expect(onConfirm).toHaveBeenCalledTimes(2)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it("une exception du serveur affiche le message générique, sans texte SQL", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('relation "wallet_ledger" does not exist (SQLSTATE 42P01)'))
    openDialog({ onConfirm })
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Une erreur est survenue. Veuillez réessayer.")
    expect(alert.textContent).not.toMatch(/relation|SQLSTATE|wallet_ledger/)
  })

  it("restaure le défilement de la page à la fermeture", () => {
    openDialog({ onConfirm: vi.fn() })
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent.keyDown(document, { key: "Escape" })
    expect(document.body.style.overflow).toBe("")
  })
})
