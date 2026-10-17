// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))

const { CloseAccountForm } = await import("./close-account-form")

function fill(confirmation, password) {
  fireEvent.change(screen.getByLabelText(/Saisissez FERMER/), { target: { value: confirmation } })
  fireEvent.change(screen.getByLabelText(/Votre mot de passe/), { target: { value: password } })
}

describe("CloseAccountForm (DOM)", () => {
  it("n'active le bouton qu'avec FERMER exact et un mot de passe", async () => {
    render(<CloseAccountForm closeAction={vi.fn()} cancelHref="/profile" />)
    const button = screen.getByRole("button", { name: "Fermer mon compte" })
    expect(button.disabled).toBe(true)
    fill("fermer", "secret")
    expect(button.disabled).toBe(true)
    fill("FERMER ", "secret")
    expect(button.disabled).toBe(true)
    fill(" FERMER", "secret")
    expect(button.disabled).toBe(true)
    fill("FERMER", "")
    expect(button.disabled).toBe(true)
    fill("FERMER", "secret")
    expect(button.disabled).toBe(false)
  })

  it("envoie les champs confirmation et password, puis affiche l'erreur et les blocages renvoyés", async () => {
    const closeAction = vi.fn(async () => ({
      error: "Votre compte ne peut pas être fermé pour le moment.",
      blockers: [{ code: "WALLET_NOT_EMPTY", message: "Votre portefeuille n'est pas à zéro." }],
    }))
    render(<CloseAccountForm closeAction={closeAction} cancelHref="/profile" />)
    fill("FERMER", "secret")
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fermer mon compte" }))
    })
    const formData = closeAction.mock.calls[0][1]
    expect(formData.get("confirmation")).toBe("FERMER")
    expect(formData.get("password")).toBe("secret")
    expect((await screen.findByRole("alert")).textContent).toContain("ne peut pas être fermé")
    expect(screen.getByText("Votre portefeuille n'est pas à zéro.")).toBeTruthy()
  })
})
