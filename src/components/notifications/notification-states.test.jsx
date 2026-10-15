import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { NotificationsEmpty, NotificationsUnavailable, NotificationsSkeleton } from "./notification-states"

describe("états des notifications", () => {
  it("état vide vouvoyé par espace, sans promesse de paiement ni de message", () => {
    for (const space of ["client", "student", "admin"]) {
      const out = renderToStaticMarkup(<NotificationsEmpty space={space} />)
      expect(out).toContain("Aucune notification")
      expect(out).not.toMatch(/paiement|message|retrait|\btu\b|\bton\b/i)
      expect(out).not.toContain("role=\"alert\"")
    }
  })

  it("filtre Non lues : message distinct", () => {
    const out = renderToStaticMarkup(<NotificationsEmpty space="client" unreadOnly />)
    expect(out).toContain("Aucune notification non lue")
  })

  it("indisponible : distinct du vide, annoncé, avec Réessayer", () => {
    const out = renderToStaticMarkup(<NotificationsUnavailable onRetry={() => {}} />)
    expect(out).toContain("Notifications indisponibles")
    expect(out).toContain('role="alert"')
    expect(out).toContain("Réessayer")
    expect(out).not.toContain("Aucune notification")
  })

  it("indisponible sans rappel : pas de bouton", () => {
    expect(renderToStaticMarkup(<NotificationsUnavailable />)).not.toContain("<button")
  })

  it("squelette : annoncé une fois, trois lignes masquées", () => {
    const out = renderToStaticMarkup(<NotificationsSkeleton />)
    expect(out).toContain('role="status"')
    expect(out).toContain("Chargement des notifications")
    expect(out.match(/ntf-skeleton__row/g)).toHaveLength(3)
    expect(renderToStaticMarkup(<NotificationsSkeleton count={5} />).match(/ntf-skeleton__row/g)).toHaveLength(5)
  })

  it("titres des états portés par la classe de titre stylée empty2__title", () => {
    expect(renderToStaticMarkup(<NotificationsEmpty space="client" />)).toMatch(/<p class="empty2__title">Aucune notification/)
    expect(renderToStaticMarkup(<NotificationsUnavailable />)).toMatch(/<p class="empty2__title">Notifications indisponibles/)
  })
})
