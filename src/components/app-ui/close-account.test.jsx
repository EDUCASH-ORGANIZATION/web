import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { CloseAccountCard, CloseAccountView } = await import("./close-account")
const { CloseAccountForm, CONFIRMATION_WORD } = await import("./close-account-form")

const action = vi.fn()
const text = (html) =>
  html
    .replace(/<script>[^]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")

describe("CloseAccountCard", () => {
  it("lie vers la page de fermeture de chaque espace, sans rien fermer", () => {
    const client = renderToStaticMarkup(<CloseAccountCard space="client" />)
    const student = renderToStaticMarkup(<CloseAccountCard space="student" />)
    expect(client).toContain('href="/client/profile/close"')
    expect(student).toContain('href="/profile/close"')
    expect(client).toContain("btn--danger-outline")
    expect(client).not.toContain("<form")
    expect(text(client)).toContain("Vous disposez de 14 jours pour changer d'avis")
    expect(client).not.toContain("@")
  })
})

describe("CloseAccountView : conditions bloquantes", () => {
  const blockers = [
    { code: "WALLET_NOT_EMPTY", message: "Votre portefeuille n'est pas à zéro." },
    { code: "REPORT_OPEN", message: "Un signalement est en cours." },
  ]
  const html = renderToStaticMarkup(
    <CloseAccountView space="student" preview={{ blockers, dueAt: "2026-10-31T10:00:00Z" }} closeAction={action} />,
  )
  const t = text(html)

  it("liste chaque point avec son message et son action, compte les points", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(t).toContain("Points à régler 2")
    expect(t).toContain("Votre portefeuille n'est pas à zéro.")
    expect(t).toContain("Un signalement est en cours.")
    expect(html).toContain('href="/wallet"')
    expect(html).toContain('href="mailto:contact@educash.bj"')
  })

  it("désactive Continuer et n'affiche aucun formulaire de confirmation", () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Continuer<\/button>/)
    expect(html).not.toContain("<form")
    expect(html).not.toContain("close-password")
    expect(html).toContain('href="/profile"')
  })
})

describe("CloseAccountView : confirmation", () => {
  const client = renderToStaticMarkup(
    <CloseAccountView space="client" preview={{ blockers: [], dueAt: "2026-10-31T10:00:00Z" }} closeAction={action} />,
  )
  const student = renderToStaticMarkup(
    <CloseAccountView space="student" preview={{ blockers: [], dueAt: "2026-10-31T10:00:00Z" }} closeAction={action} />,
  )

  it("montre la frise de 14 jours, ce qui est effacé et gardé", () => {
    const t = text(client)
    expect(t).toContain("Un délai de 14 jours pour changer d'avis")
    expect(t).toContain("Jusqu'au 31 octobre 2026")
    expect(t).toMatch(/À partir du 1(er)? novembre 2026/)
    expect(t).toContain("Ce qui sera effacé")
    expect(t).toContain("Ce qui sera gardé")
    expect(t).toContain("Compte clôturé")
  })

  it("ajoute la carte étudiante aux données effacées de l'étudiant seulement", () => {
    expect(text(student)).toContain("Votre carte étudiante")
    expect(text(client)).not.toContain("carte étudiante")
  })

  it("porte la saisie FERMER, le mot de passe et un bouton danger", () => {
    expect(client).toContain('name="confirmation"')
    expect(client).toContain('name="password"')
    expect(client).toMatch(/class="btn btn--danger[^"]*"/)
    expect(text(client)).toContain(`Saisissez ${CONFIRMATION_WORD} pour confirmer`)
    expect(client).not.toContain("Continuer")
  })

  it("sans échéance, la frise ne cite aucune date", () => {
    const html = renderToStaticMarkup(
      <CloseAccountView space="client" preview={{ blockers: [] }} closeAction={action} />,
    )
    expect(text(html)).toContain("Pendant 14 jours")
  })
})

describe("CloseAccountView : lecture impossible", () => {
  it("affiche un état d'erreur sans formulaire ni blocage", () => {
    for (const preview of [{ error: "Erreur interne secrète" }, undefined, {}]) {
      const html = renderToStaticMarkup(<CloseAccountView space="client" preview={preview} closeAction={action} />)
      expect(text(html)).toContain("Impossible de vérifier votre compte")
      expect(html).not.toContain("secrète")
      expect(html).not.toContain("<form")
      expect(html.match(/<h1\b/g)).toHaveLength(1)
    }
  })
})

describe("CloseAccountForm", () => {
  it("bouton inactif avant hydratation, sans bandeau d'erreur au départ", () => {
    const html = renderToStaticMarkup(<CloseAccountForm closeAction={action} cancelHref="/profile" />)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Fermer mon compte<\/button>/)
    expect(html).not.toContain("banner--erreur")
    expect(html).toContain('href="/profile"')
  })
})
