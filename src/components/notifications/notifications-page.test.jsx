import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { NotificationsPage } from "./notifications-page"
import { NotificationsProvider } from "./notifications-provider"

const NOW = "2026-10-15T12:00:00Z"
const M = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const S = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"
const row = (id, over = {}) => ({
  id,
  type: "application_received",
  title: `Titre ${id}`,
  body: `Corps ${id}`,
  mission_id: M,
  actor_id: S,
  read_at: null,
  created_at: "2026-10-15T10:00:00Z",
  ...over,
})
const actions = { list: async () => ({}), markRead: async () => ({}), markAll: async () => ({}) }

function page(props, count = 2) {
  return renderToStaticMarkup(
    <NotificationsProvider space={props.space ?? "client"} initialCount={count} actions={{}}>
      <NotificationsPage nowIso={NOW} actions={actions} filter="all" {...props} />
    </NotificationsProvider>,
  )
}

const data = (rows, nextCursor = null, unreadCount = 2) => ({ items: rows, nextCursor, unreadCount })

describe("NotificationsPage", () => {
  it("liste groupée, un seul bouton encre, titre h1 unique", () => {
    const out = page({ space: "client", initial: data([row("1"), row("2"), row("3", { created_at: "2026-10-01T10:00:00Z" })]) })
    expect(out.match(/<h1 /g)).toHaveLength(1)
    expect(out).toContain("Aujourd&#x27;hui")
    expect(out).toContain("Plus tôt")
    expect(out.match(/btn--dark/g)).toHaveLength(1)
    expect(out).toContain(`href="/client/missions/${M}?candidat=${S}"`)
    expect(out).toContain("Tout marquer comme lu")
  })

  it("client : en-tête mobile standard de la coquille, aucun en-tête de sous-page inventé", () => {
    const out = page({ space: "client", initial: data([row("1")]) })
    expect(out).not.toContain("e2-mtop")
    expect(out).not.toContain("a2-mtop")
  })

  it("étudiant : en-tête e2-mtop avec retour, titre et marquage 44 px", () => {
    const out = page({ space: "student", initial: data([row("1", { type: "application_accepted" })]) })
    expect(out).toContain("e2-mtop")
    expect(out).toContain('href="/dashboard"')
    expect(out).toContain('aria-label="Tout marquer comme lu"')
    expect(out).toContain("i-check-double")
    expect(out).toContain("ds-desk-only")
    expect(out).toContain('href="/student/missions/' + M + '"')
  })

  it("admin : en-tête a2-mtop, lien vers les dossiers", () => {
    const out = page({ space: "admin", initial: data([row("1", { type: "card_submitted" })]) })
    expect(out).toContain("a2-mtop")
    expect(out).toContain('href="/admin/verifications"')
    expect(out).toContain('href="/admin/dashboard"')
  })

  it("filtre Non lues : liens de filtre de l'espace, état courant exposé", () => {
    const anchors = (html) => [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0])
    const filterLinks = (html) => anchors(html).filter((a) => /segmented__item/.test(a))
    const rows = [row("1", { type: "application_accepted" })]
    const all = filterLinks(page({ space: "student", filter: "all", initial: data(rows) }))
    expect(all).toHaveLength(2)
    expect(all[0]).toMatch(/href="\/student\/notifications"/)
    expect(all[0]).toMatch(/aria-current="page"/)
    expect(all[1]).toMatch(/href="\/student\/notifications\?filtre=non-lues"/)
    expect(all[1]).not.toMatch(/aria-current/)
    const unread = filterLinks(page({ space: "student", filter: "unread", initial: data(rows) }))
    expect(unread[0]).not.toMatch(/aria-current/)
    expect(unread[1]).toMatch(/aria-current="page"/)
  })

  it("pagination : « Afficher plus » seulement s'il reste des notifications", () => {
    expect(page({ space: "client", initial: data([row("1")], "curseur") })).toContain("Afficher plus")
    expect(page({ space: "client", initial: data([row("1")], null) })).not.toContain("Afficher plus")
  })

  it("aucune notification : état vide calme et vouvoyé", () => {
    const out = page({ space: "client", initial: data([], null, 0) }, 0)
    expect(out).toContain("Aucune notification")
    expect(out).not.toContain("Tout marquer comme lu")
  })

  it("filtre Non lues vide : message distinct", () => {
    const out = page({ space: "client", filter: "unread", initial: data([], null, 0) }, 0)
    expect(out).toContain("Aucune notification non lue")
  })

  it("lecture impossible : « Notifications indisponibles », distinct du vide, avec Réessayer", () => {
    const out = page({ space: "client", initial: null }, 0)
    expect(out).toContain("Notifications indisponibles")
    expect(out).toContain("Réessayer")
    expect(out).toContain('role="alert"')
    expect(out).not.toContain("Aucune notification")
  })

  it("corps hostile : texte échappé, jamais interprété ; lien jamais lu de la ligne", () => {
    const hostile = row("1", {
      title: "<img src=x onerror=alert(1)>",
      body: "<script>alert(1)</script>",
      href: "https://evil.example",
      url: "javascript:alert(1)",
    })
    const out = page({ space: "client", initial: data([hostile]) })
    expect(out).not.toContain("<img src=x")
    expect(out).not.toContain("<script>")
    expect(out).not.toContain("evil.example")
    expect(out).not.toContain("javascript:")
  })

  it("aucun lien de réglages (page inexistante), aucun nom de prestataire", () => {
    const out = page({ space: "client", initial: data([row("1")]) })
    expect(out).not.toMatch(/Régler|Réglages|FedaPay/i)
  })

  it("éléments non lus signalés aux lecteurs d'écran", () => {
    const out = page({ space: "client", initial: data([row("1"), row("2", { read_at: "2026-10-15T11:00:00Z" })]) })
    expect(out.match(/Non lue\. /g)).toHaveLength(1)
  })
})
