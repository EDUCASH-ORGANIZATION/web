import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { StudentDashboardView } = await import("./student-dashboard-view")

const TODAY = "2026-10-08"
const VERIFIED = { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: 200, action: null }
const verif = (key, over = {}) => ({
  key,
  label: key,
  canApply: key === "pending",
  daysLeft: null,
  action: { label: "Envoyer ma carte", href: "/profile/verify" },
  ...over,
})

const data = (over = {}) => ({
  firstName: "Sèna",
  wallet: { available: 47600, escrowToCome: 40480, earnedThisMonth: 29040 },
  verification: VERIFIED,
  inProgress: [],
  unread: [],
  pendingApplications: { count: 3, lastAt: "2026-10-07T10:00:00Z" },
  rating: { value: 4.9, reviewsCount: 12 },
  toReview: [],
  hasActivity: true,
  ...over,
})

const WITH_MISSIONS = data({
  inProgress: [
    { id: "m1", title: "Cours de maths", clientName: "Rosine", budget: 15000 },
    { id: "m2", title: "Traduction", clientName: "Koffi", budget: 6000 },
  ],
  unread: [{ missionId: "m1", title: "Cours de maths", clientName: "Rosine", count: 2 }],
  toReview: [{ id: "d1", title: "Flyer", clientName: "Afi" }],
})

const render = (props) => renderToStaticMarkup(<StudentDashboardView today={TODAY} paymentsEnabled {...props} />)
const h1s = (html) => html.match(/<h1\b/g) ?? []

describe("StudentDashboardView : avec missions en cours", () => {
  const html = render({ data: WITH_MISSIONS })

  it("un seul h1, salutation tutoyée et date", () => {
    expect(h1s(html)).toHaveLength(1)
    expect(html).toContain("Bonjour, Sèna")
    expect(html).toContain("Jeudi 8 octobre")
  })

  it("une seule carte colorée (argent) et une seule étiquette citron", () => {
    expect(html.match(/class="money2 /g) ?? html.match(/class="money2"/g)).toHaveLength(1)
    expect(html.match(/class="flag2"/g)).toHaveLength(1)
  })

  it("carte argent : disponible, gains du mois, séquestre à venir", () => {
    expect(html).toContain("Disponible sur ton portefeuille")
    expect(html).toContain("gagnés ce mois-ci")
    expect(html).toContain("à venir, en séquestre")
  })

  it("action prioritaire : répondre au client, un seul bouton encre", () => {
    expect(html).toContain("Réponds à Rosine")
    expect(html).toMatch(/<a class="btn btn--dark" href="\/messages\/m1">/)
    expect(html.match(/btn btn--dark/g)).toHaveLength(1)
  })

  it("trois indicateurs", () => {
    expect(html).toContain("Missions en cours")
    expect(html).toContain("Candidatures en attente")
    expect(html).toContain("Ta note")
    expect(html).toContain("4,9<small>/ 5</small>")
    expect(html).toContain("12 avis")
  })

  it("liste « Ensuite » : avis à laisser et mission en cours restante", () => {
    expect(html).toContain("Ensuite")
    expect(html).toContain('href="/review/d1"')
    expect(html).toContain("Traduction")
  })

  it("aucun vouvoiement, aucune fonction hors périmètre, aucun emoji", () => {
    expect(html).not.toMatch(/\b(vous|votre|vos)\b/i)
    expect(html).not.toMatch(/livré|à confirmer|achats|40 %|relevé de notes/i)
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe("StudentDashboardView : paiements", () => {
  it("coupés : aucun bouton Retirer, note d'activation tutoyée", () => {
    const html = render({ data: WITH_MISSIONS, paymentsEnabled: false })
    expect(html).not.toContain("Retirer")
    expect(html).not.toContain("retrait=1")
    expect(html).toContain("Tes gains restent en sécurité sur ton portefeuille EduCash")
  })

  it("ouverts : Retirer mène au retrait du portefeuille", () => {
    const html = render({ data: WITH_MISSIONS, paymentsEnabled: true })
    expect(html).toMatch(/<a class="btn btn--blanc" href="\/wallet\?retrait=1">/)
    expect(html).not.toContain("Tes gains restent en sécurité")
  })
})

describe("StudentDashboardView : états", () => {
  it("nouvel inscrit : 0 FCFA, trouve ta première mission, premiers pas, pas de citron", () => {
    const html = render({
      data: data({
        hasActivity: false,
        verification: verif("pending", { action: null }),
        wallet: { available: 0, escrowToCome: 0, earnedThisMonth: 0 },
        pendingApplications: { count: 0, lastAt: null },
        rating: { value: 0, reviewsCount: 0 },
      }),
    })
    expect(h1s(html)).toHaveLength(1)
    expect(html).toContain("Trouve ta première mission")
    expect(html).toContain("Tes gains arriveront ici après ta première mission.")
    expect(html).toContain("Premiers pas")
    expect(html).toContain("1 sur 2")
    expect(html).toContain("flag2 flag2--neutre")
    expect(html).not.toContain('class="flag2"')
  })

  it.each([
    ["not_submitted", "Envoie ta carte étudiante"],
    ["rejected", "Renvoie ta carte étudiante"],
    ["expired", "Ton badge a expiré"],
    ["expiring", "Renouvelle ton badge vérifié"],
  ])("statut de vérification %s : action due en citron vers la vérification", (key, title) => {
    const html = render({ data: data({ verification: verif(key, { daysLeft: key === "expiring" ? 12 : -3 }) }) })
    expect(html).toContain(title)
    expect(html).toContain('class="flag2"')
    expect(html).toContain('href="/profile/verify"')
    expect(html).not.toContain("Compte vérifié")
  })

  it("carte en cours d'examen : aucune action de vérification, candidatures possibles", () => {
    const html = render({ data: data({ verification: verif("pending", { action: null }) }) })
    expect(html).toContain("Tout est à jour")
    expect(html).toContain("Ta carte est en cours d&#x27;examen : tu peux déjà postuler")
    expect(html).not.toContain('class="flag2"')
  })

  it("rien cette semaine : étiquette neutre, liste vide, lien vers les missions", () => {
    const html = render({ data: data() })
    expect(html).toContain("Tout est à jour")
    expect(html).toContain("flag2 flag2--neutre")
    expect(html).toContain("Rien cette semaine")
    expect(html).toContain('href="/student/missions"')
    expect(html).not.toContain('class="flag2"')
  })

  it("mission en cours sans autre action : prévenir le client, ta part, pas de bouton J'ai terminé", () => {
    const html = render({ data: data({ inProgress: [{ id: "m1", title: "Cours de maths", clientName: "Rosine", budget: 15000 }] }) })
    expect(html).toContain("Préviens Rosine quand c&#x27;est fini")
    expect(html).toContain("le client confirme la fin")
    expect(html).not.toContain("J&#x27;ai terminé")
    expect(html).toContain("flag2 flag2--neutre")
  })

  it("aucun avis : pas de note chiffrée", () => {
    const html = render({ data: data({ rating: { value: 0, reviewsCount: 0 } }) })
    expect(html).toContain("0 avis")
    expect(html).not.toContain("<small>/ 5</small>")
  })

  it("erreur : bloc distinct du vide, un seul h1, message neutre tutoyé", () => {
    const html = render({ error: "Impossible de charger ton tableau de bord." })
    expect(h1s(html)).toHaveLength(1)
    expect(html).toContain('role="alert"')
    expect(html).toContain("Impossible de charger ton tableau de bord")
    expect(html).toContain("Réessayer")
    expect(html).not.toContain("Tout est à jour")
    expect(html).not.toMatch(/\b(vous|votre|vos)\b/i)
  })
})
