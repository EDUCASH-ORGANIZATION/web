// @vitest-environment jsdom
// @ds-screen RD-STUDENT-01
// Interactions réelles de l'îlot « J'ai terminé » (E05, RD-DONE-01 ST-09) : ouverture, focus, Échap, verrou anti
// double clic, erreurs, succès. Modèle : src/components/app-ui/confirm-dialog.dom.test.jsx.
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"

const declareMock = vi.fn()
const refreshMock = vi.fn()
const successMock = vi.fn()
vi.mock("@/lib/actions/mission-completion.actions", () => ({ declareMissionCompletion: (...a) => declareMock(...a) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }))
vi.mock("@/components/app-ui/toast", () => ({ useAppToast: () => ({ success: successMock, error: vi.fn() }) }))

const { DeclareEnd, declareOnce, refreshAndClose } = await import("./declare-end")

const NAME = "J'ai terminé"

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function setup(props = {}) {
  return render(
    <DeclareEnd
      missionId="m1"
      title="Cours de maths niveau 3e"
      clientName="Rosine H."
      net={22000}
      paymentsEnabled
      reportHref="/contact?sujet=question"
      {...props}
    />,
  )
}

const openByButton = () => fireEvent.click(screen.getAllByRole("button", { name: NAME })[0])
const submit = () => screen.getByRole("button", { name: "Oui, j'ai terminé" })

beforeEach(() => {
  declareMock.mockReset()
  refreshMock.mockReset()
  successMock.mockReset()
})

describe("DeclareEnd (interactions)", () => {
  it("fermé au départ : la carte et la barre montrent chacune le bouton, aucune modale, aucun appel", () => {
    setup()
    expect(screen.getAllByRole("button", { name: NAME })).toHaveLength(2)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(declareMock).not.toHaveBeenCalled()
  })

  it("le bouton de la carte et celui de la barre ouvrent la même modale, sans appeler l'action", () => {
    setup()
    fireEvent.click(screen.getAllByRole("button", { name: NAME })[0])
    expect(screen.getByRole("dialog", { name: "Vous confirmez avoir terminé ?" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getAllByRole("button", { name: NAME })[1])
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    expect(declareMock).not.toHaveBeenCalled()
  })

  it("initialOpen (?terminer=1) ouvre la modale au premier rendu sans appeler l'action", () => {
    setup({ initialOpen: true })
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(declareMock).not.toHaveBeenCalled()
  })

  it("le focus initial est sur « Annuler » et Échap ferme la modale", () => {
    setup()
    openByButton()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Annuler" }))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(declareMock).not.toHaveBeenCalled()
  })

  it("double clic : une seule invocation de l'action", async () => {
    const pending = deferred()
    declareMock.mockReturnValue(pending.promise)
    setup()
    openByButton()
    const button = submit()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(declareMock).toHaveBeenCalledTimes(1)
    expect(declareMock).toHaveBeenCalledWith("m1")
    await act(async () => pending.resolve({ success: true, alreadyDeclared: false, declaredAt: "2026-10-12T09:00:00Z" }))
    expect(declareMock).toHaveBeenCalledTimes(1)
  })

  it("pendant l'envoi : bouton inactif et « Annuler » inactif", async () => {
    const pending = deferred()
    declareMock.mockReturnValue(pending.promise)
    setup()
    openByButton()
    fireEvent.click(submit())
    expect(screen.getByRole("button", { name: "Envoi en cours" }).disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Annuler" }).disabled).toBe(true)
    await act(async () => pending.resolve({ success: true, alreadyDeclared: false }))
  })

  it("succès : fermeture, toast « C'est noté. » avec le prénom, router.refresh", async () => {
    declareMock.mockResolvedValue({ success: true, alreadyDeclared: false, declaredAt: "2026-10-12T09:00:00Z" })
    setup()
    openByButton()
    await act(async () => fireEvent.click(submit()))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(successMock).toHaveBeenCalledWith("C'est noté.", "Rosine doit maintenant confirmer la fin.")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("déjà déclarée (alreadyDeclared) : même issue qu'un succès", async () => {
    declareMock.mockResolvedValue({ success: true, alreadyDeclared: true, declaredAt: "2026-10-12T09:00:00Z" })
    setup({ clientName: "Client EduCash" })
    openByButton()
    await act(async () => fireEvent.click(submit()))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(successMock).toHaveBeenCalledWith("C'est noté.", "Le client doit maintenant confirmer la fin.")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("erreur : message de l'action dans une alerte, la modale reste ouverte, nouvel essai possible", async () => {
    declareMock.mockResolvedValueOnce({ error: "Une erreur est survenue. Réessayez dans un instant.", code: "generic" })
    setup()
    openByButton()
    await act(async () => fireEvent.click(submit()))
    expect(screen.getByRole("alert").textContent).toContain("Une erreur est survenue. Réessayez dans un instant.")
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(successMock).not.toHaveBeenCalled()
    declareMock.mockResolvedValueOnce({ success: true, alreadyDeclared: false })
    await act(async () => fireEvent.click(submit()))
    expect(declareMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("exception de l'action : message générique vouvoyé, pas de plantage", async () => {
    declareMock.mockRejectedValue(new Error("réseau"))
    setup()
    openByButton()
    await act(async () => fireEvent.click(submit()))
    expect(screen.getByRole("alert").textContent).toContain("Réessayez dans un instant.")
  })

  it("already_done : « Actualiser » remplace l'envoi, recharge la page puis ferme", async () => {
    declareMock.mockResolvedValue({ error: "Cette mission est déjà terminée.", code: "already_done" })
    setup()
    openByButton()
    await act(async () => fireEvent.click(submit()))
    expect(screen.getByRole("alert").textContent).toContain("Cette mission est déjà terminée.")
    expect(screen.queryByRole("button", { name: "Oui, j'ai terminé" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }))
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("not_in_progress : « Actualiser » remplace l'envoi qui échouerait à chaque clic", async () => {
    declareMock.mockResolvedValue({ error: "Cette mission n'est plus en cours.", code: "not_in_progress" })
    setup()
    openByButton()
    await act(async () => fireEvent.click(submit()))
    expect(screen.queryByRole("button", { name: "Oui, j'ai terminé" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }))
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("unavailable : le message s'affiche et il n'y a plus de bouton d'envoi", async () => {
    declareMock.mockResolvedValue({ error: "Cette fonction n'est pas encore disponible.", code: "unavailable" })
    setup()
    openByButton()
    await act(async () => fireEvent.click(submit()))
    expect(screen.getByRole("alert").textContent).toContain("Cette fonction n'est pas encore disponible.")
    expect(screen.queryByRole("button", { name: "Oui, j'ai terminé" })).toBeNull()
    expect(screen.getByRole("button", { name: "Annuler" })).toBeTruthy()
    expect(declareMock).toHaveBeenCalledTimes(1)
  })

  it("gain invalide (net null) : barre sans montant, modale sans ligne de part, bouton présent", () => {
    setup({ net: null, initialOpen: true })
    expect(screen.getAllByRole("button", { name: NAME })).toHaveLength(2)
    expect(screen.getByRole("dialog").textContent).not.toContain("Votre part")
  })

  it("paiements fermés : ni séquestre ni part dans la barre et la modale", () => {
    const { container } = setup({ paymentsEnabled: false, initialOpen: true })
    expect(container.textContent).not.toMatch(/séquestre|versée après/)
  })

  it("ne contient aucune coordonnée du client ni lien de portefeuille", () => {
    const { container } = setup({ initialOpen: true })
    expect(container.innerHTML).not.toMatch(/@|\+229|wallet|portefeuille/i)
  })
})

describe("declareOnce (verrou)", () => {
  it("un second appel pendant le premier est ignoré, puis le verrou est relâché", async () => {
    const pending = deferred()
    const action = vi.fn().mockReturnValue(pending.promise)
    const lock = { busy: false }
    const first = declareOnce(lock, action, "m1")
    expect(await declareOnce(lock, action, "m1")).toEqual({ skipped: true })
    pending.resolve({ success: true, alreadyDeclared: false })
    expect(await first).toEqual({ success: true, alreadyDeclared: false })
    expect(lock.busy).toBe(false)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it("erreur sans code : code generic ; réponse vide : message générique ; exception : message générique", async () => {
    expect(await declareOnce({ busy: false }, async () => ({ error: "Non." }), "m1")).toEqual({ error: "Non.", code: "generic" })
    expect((await declareOnce({ busy: false }, async () => undefined, "m1")).code).toBe("generic")
    const thrown = await declareOnce({ busy: false }, async () => { throw new Error("x") }, "m1")
    expect(thrown.error).toContain("Réessayez")
  })

  it("le verrou est relâché même après une erreur", async () => {
    const lock = { busy: false }
    await declareOnce(lock, async () => ({ error: "Non.", code: "not_found" }), "m1")
    expect(lock.busy).toBe(false)
  })
})

describe("refreshAndClose", () => {
  it("recharge puis ferme", () => {
    const calls = []
    refreshAndClose(() => calls.push("refresh"), () => calls.push("close"))
    expect(calls).toEqual(["refresh", "close"])
  })
})
