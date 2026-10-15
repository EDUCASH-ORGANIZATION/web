import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

// La Modal est remplacée par un relevé de ses props : on vérifie que le focus initial demandé est le bouton « Annuler »
// du pied (choix sûr de l'ancien ConfirmDialog), jamais la confirmation ni le bouton de fermeture.
const seen = []
vi.mock("@/components/app-ui/modal", () => ({
  Modal: (props) => {
    seen.push(props)
    return null
  },
}))

const { ApproveDialog } = await import("./approve-dialog")
const { RejectDialog } = await import("./reject-dialog")
const { ResetDialog } = await import("./reset-dialog")
const { RevokeDialog } = await import("./revoke-dialog")

const noop = () => {}
const buttonsOf = (footer) => [footer.props.children].flat().filter((n) => n && n.type === "button")

describe("modales de vérification : focus initial sur « Annuler »", () => {
  it.each([
    ["validation", <ApproveDialog key="a" open onClose={noop} onConfirm={noop} name="Codjo" badgeUntil="2027-10-15" />],
    ["refus", <RejectDialog key="r" open onClose={noop} onConfirm={noop} name="Codjo" />],
    ["réinitialisation", <ResetDialog key="s" open onClose={noop} onConfirm={noop} name="Codjo" />],
    ["révocation", <RevokeDialog key="v" open onClose={noop} onConfirm={noop} name="Codjo" />],
  ])("%s", (_, element) => {
    seen.length = 0
    renderToStaticMarkup(element)
    expect(seen).toHaveLength(1)
    const { initialFocusRef, footer } = seen[0]
    expect(initialFocusRef).toBeTruthy()
    const [cancel, confirm] = buttonsOf(footer)
    expect(cancel.props.children).toBe("Annuler")
    expect(cancel.props.ref).toBe(initialFocusRef)
    expect(confirm.props.ref).toBeUndefined()
  })
})
